import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';
import { generateOpaqueToken, hashOpaqueToken } from '../lib/tokens.js';
import { mailer } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import type { WorkspaceSummary } from './workspace.service.js';
import { getActiveMembership, assertWorkspaceExists } from './membership.service.js';
import { canManageMembers, canInviteRole } from '../policies/workspace.policy.js';
import type {
  CreateInvitationInput,
  InvitationListQueryInput,
} from '../schemas/membership.schemas.js';

export interface InvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationListResult {
  items: InvitationSummary[];
  page: number;
  limit: number;
  total: number;
}

function computeStatus(inv: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' {
  if (inv.acceptedAt) return 'ACCEPTED';
  if (inv.revokedAt) return 'REVOKED';
  if (inv.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  return 'PENDING';
}

function toSummary(inv: {
  id: string;
  workspaceId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}): InvitationSummary {
  return {
    id: inv.id,
    workspaceId: inv.workspaceId,
    email: inv.email,
    role: inv.role,
    status: computeStatus(inv),
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
  };
}

function invitationExpiry(): Date {
  return new Date(Date.now() + env.INVITATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createInvitation(
  workspaceId: string,
  actorUserId: string,
  input: CreateInvitationInput,
): Promise<InvitationSummary> {
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canManageMembers(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  if (!canInviteRole(actor.role, input.role)) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot invite this role');
  }

  await assertWorkspaceExists(workspaceId);

  const email = input.email;

  // Check existing active membership for this email.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    const existingMembership = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      select: { status: true },
    });
    if (existingMembership && existingMembership.status === 'ACTIVE') {
      throw new AppError(409, 'ALREADY_MEMBER', 'User is already a member of this workspace');
    }
  }

  // Fetch workspace name + inviter name for email (after commit).
  const [workspace, inviter] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: actorUserId }, select: { displayName: true } }),
  ]);
  if (!workspace || !inviter) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const token = generateOpaqueToken();

  const invitation = await prisma.$transaction(async (tx) => {
    // Revoke prior pending invitations for this email+workspace.
    await tx.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });

    const created = await tx.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: input.role,
        tokenHash: token.hash,
        invitedByUserId: actorUserId,
        expiresAt: invitationExpiry(),
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        acceptedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return created;
  });

  // Send email after commit.
  void mailer
    .sendWorkspaceInvitationEmail(email, token.raw, workspace.name, inviter.displayName)
    .catch((error) => {
      logger.error({ err: error }, 'Failed to send workspace invitation email');
    });

  return toSummary(invitation);
}

export async function listInvitations(
  workspaceId: string,
  actorUserId: string,
  query: InvitationListQueryInput,
): Promise<InvitationListResult> {
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canManageMembers(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where: {
    workspaceId: string;
    email?: { contains: string };
  } & Record<string, unknown> = { workspaceId };

  // Status filter handled post-query? Status is computed. For DB filtering, map.
  if (query.q) {
    where.email = { contains: query.q };
  }

  // We'll fetch all matching by workspace (+q) then filter status in memory? Better: filter by accepted/revoked/expired via date conditions.
  // Build status condition.
  const now = new Date();
  const statusConditions: Record<string, unknown> = {};
  if (query.status === 'PENDING') {
    statusConditions.acceptedAt = null;
    statusConditions.revokedAt = null;
    statusConditions.expiresAt = { gt: now };
  } else if (query.status === 'ACCEPTED') {
    statusConditions.acceptedAt = { not: null };
  } else if (query.status === 'REVOKED') {
    statusConditions.revokedAt = { not: null };
  } else if (query.status === 'EXPIRED') {
    statusConditions.acceptedAt = null;
    statusConditions.revokedAt = null;
    statusConditions.expiresAt = { lte: now };
  }

  const finalWhere = { ...where, ...statusConditions };

  const [invitations, total] = await Promise.all([
    prisma.workspaceInvitation.findMany({
      where: finalWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.workspaceInvitation.count({ where: finalWhere }),
  ]);

  const items = invitations.map(toSummary);
  return { items, page, limit, total };
}

export async function resendInvitation(
  workspaceId: string,
  actorUserId: string,
  invitationId: string,
): Promise<InvitationSummary> {
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canManageMembers(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id: invitationId, workspaceId },
  });
  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }

  const status = computeStatus(invitation);
  if (status !== 'PENDING') {
    throw new AppError(409, 'INVITATION_NOT_PENDING', 'Invitation is not pending');
  }

  // Role grant ceiling re-check (role already stored; ensure actor can still grant it).
  if (!canInviteRole(actor.role, invitation.role)) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot manage this invitation');
  }

  const token = generateOpaqueToken();

  const [workspace, inviter] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: actorUserId }, select: { displayName: true } }),
  ]);

  const updated = await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: {
      tokenHash: token.hash,
      expiresAt: invitationExpiry(),
      revokedAt: null,
    },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      acceptedAt: true,
      revokedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (workspace && inviter) {
    void mailer
      .sendWorkspaceInvitationEmail(
        invitation.email,
        token.raw,
        workspace.name,
        inviter.displayName,
      )
      .catch((error) => {
        logger.error({ err: error }, 'Failed to send workspace invitation email');
      });
  }

  return toSummary(updated);
}

export async function revokeInvitation(
  workspaceId: string,
  actorUserId: string,
  invitationId: string,
): Promise<void> {
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canManageMembers(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id: invitationId, workspaceId },
  });
  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }

  const status = computeStatus(invitation);
  if (status !== 'PENDING') {
    throw new AppError(409, 'INVITATION_NOT_PENDING', 'Invitation is not pending');
  }

  if (!canInviteRole(actor.role, invitation.role)) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot manage this invitation');
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });
}

export async function acceptInvitation(
  userId: string,
  userEmail: string,
  tokenRaw: string,
): Promise<{
  workspace: WorkspaceSummary;
  membership: { id: string; role: string; status: string };
}> {
  const tokenHash = hashOpaqueToken(tokenRaw);
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }

  const status = computeStatus(invitation);
  if (status === 'ACCEPTED') {
    if (invitation.acceptedUserId === userId) {
      // Idempotent: return existing membership.
      const membership = await prisma.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
        select: { id: true, role: true, status: true },
      });
      if (membership) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: invitation.workspaceId },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logoUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!workspace) {
          throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
        }
        return {
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
            logoUrl: workspace.logoUrl,
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
          },
          membership: { id: membership.id, role: membership.role, status: membership.status },
        };
      }
    }
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }

  if (status === 'REVOKED' || status === 'EXPIRED') {
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }

  // Email match.
  if (userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AppError(
      403,
      'INVITATION_EMAIL_MISMATCH',
      'Invitation email does not match your account',
    );
  }

  await assertWorkspaceExists(invitation.workspaceId);

  // Transaction: create/reactivate membership + mark accepted.
  let result: {
    membership: { id: string; role: string; status: string };
    workspace: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      logoUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  };
  try {
    result = await prisma.$transaction(async (tx) => {
      // Re-check invitation state inside the transaction (concurrency).
      const fresh = await tx.workspaceInvitation.findUnique({
        where: { id: invitation.id },
        select: { acceptedAt: true, revokedAt: true, expiresAt: true },
      });
      if (!fresh || fresh.revokedAt || fresh.expiresAt.getTime() <= Date.now()) {
        throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
      }
      if (fresh.acceptedAt) {
        throw new AppError(409, 'INVITATION_ALREADY_ACCEPTED', 'Invitation already accepted');
      }

      const existing = await tx.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
        select: { id: true, role: true, status: true },
      });

      let membership;
      if (existing) {
        const newRole = existing.role === 'OWNER' ? 'OWNER' : invitation.role;
        membership = await tx.workspaceMembership.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', role: newRole },
          select: { id: true, role: true, status: true },
        });
      } else {
        try {
          membership = await tx.workspaceMembership.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId,
              role: invitation.role,
              status: 'ACTIVE',
            },
            select: { id: true, role: true, status: true },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const again = await tx.workspaceMembership.findUnique({
              where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
              select: { id: true, role: true, status: true },
            });
            if (!again) throw error;
            membership = await tx.workspaceMembership.update({
              where: { id: again.id },
              data: { status: 'ACTIVE', role: again.role === 'OWNER' ? 'OWNER' : invitation.role },
              select: { id: true, role: true, status: true },
            });
          } else {
            throw error;
          }
        }
      }

      const updated = await tx.workspaceInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date(), acceptedUserId: userId },
      });
      if (updated.count === 0) {
        throw new AppError(409, 'INVITATION_ALREADY_ACCEPTED', 'Invitation already accepted');
      }

      const workspace = await tx.workspace.findUnique({
        where: { id: invitation.workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { membership, workspace };
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'INVITATION_ALREADY_ACCEPTED') {
      // Idempotent: resolve existing membership.
      const membership = await prisma.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
        select: { id: true, role: true, status: true },
      });
      const workspace = await prisma.workspace.findUnique({
        where: { id: invitation.workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!membership || !workspace) {
        throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
      }
      result = {
        membership,
        workspace,
      };
    } else {
      throw error;
    }
  }

  if (!result.workspace) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const workspace = result.workspace;
  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      logoUrl: workspace.logoUrl,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    },
    membership: {
      id: result.membership.id,
      role: result.membership.role,
      status: result.membership.status,
    },
  };
}

export async function declineInvitation(userEmail: string, tokenRaw: string): Promise<void> {
  const tokenHash = hashOpaqueToken(tokenRaw);
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }

  const status = computeStatus(invitation);
  if (status === 'ACCEPTED') {
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }
  if (status === 'REVOKED' || status === 'EXPIRED') {
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }

  if (userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AppError(
      403,
      'INVITATION_EMAIL_MISMATCH',
      'Invitation email does not match your account',
    );
  }

  const updated = await prisma.workspaceInvitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (updated.count === 0) {
    throw new AppError(400, 'INVALID_INVITATION_TOKEN', 'Invalid or expired invitation token');
  }
}
