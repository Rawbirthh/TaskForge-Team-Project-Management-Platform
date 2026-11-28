import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { verifyPassword } from '../lib/password.js';
import { getActiveMembership } from './membership.service.js';
import {
  canChangeSlug,
  canManageWorkspaceSettings,
  canTransferOwnership,
} from '../policies/workspace.policy.js';
import {
  createWorkspaceSchema,
  normalizeSlug,
  type CreateWorkspaceInput,
  type WorkspaceIdParamInput,
  type WorkspaceListQueryInput,
  type SlugAvailabilityQueryInput,
  type UpdateWorkspaceSettingsInput,
  type TransferOwnershipInput,
} from '../schemas/workspace.schemas.js';

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMembershipSummary {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
  createdAt: Date;
}

export interface WorkspaceListItem {
  workspace: WorkspaceSummary;
  membership: WorkspaceMembershipSummary;
}

export interface WorkspaceListResult {
  items: WorkspaceListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface WorkspaceDetail {
  workspace: WorkspaceSummary;
  membership: Pick<WorkspaceMembershipSummary, 'id' | 'role' | 'status'>;
}

function toWorkspaceSummary(workspace: WorkspaceRow): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    logoUrl: workspace.logoUrl,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function deriveSlug(name: string): string {
  const derived = normalizeSlug(name);
  if (derived.length >= 3) return derived.slice(0, 48);
  return `workspace-${derived}`.slice(0, 48);
}

export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
): Promise<WorkspaceSummary> {
  const parsed = createWorkspaceSchema.parse(input);
  const name = parsed.name;
  const slug = parsed.slug ?? deriveSlug(name);

  // Ensure derived slug still satisfies format; if not, fall back.
  let finalSlug = slug;
  if (finalSlug.length < 3) {
    finalSlug = `workspace-${finalSlug}`.slice(0, 48);
  }

  try {
    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: { name, slug: finalSlug },
        select: workspaceSelect,
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: created.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      return created;
    });

    return toWorkspaceSummary(workspace);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'WORKSPACE_SLUG_TAKEN', 'A workspace with this slug already exists');
    }
    throw error;
  }
}

export async function listWorkspaces(
  userId: string,
  query: WorkspaceListQueryInput,
): Promise<WorkspaceListResult> {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where = { userId, status: 'ACTIVE' as const };

  const [memberships, total] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where,
      include: {
        workspace: {
          select: workspaceSelect,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.workspaceMembership.count({ where }),
  ]);

  const items: WorkspaceListItem[] = memberships.map((membership) => ({
    workspace: toWorkspaceSummary(membership.workspace),
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt,
    },
  }));

  return { items, page, limit, total };
}

export async function getWorkspace(
  userId: string,
  workspaceId: WorkspaceIdParamInput['workspaceId'],
): Promise<WorkspaceDetail> {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, userId, status: 'ACTIVE' },
    include: {
      workspace: {
        select: workspaceSelect,
      },
    },
  });

  if (!membership) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  return {
    workspace: toWorkspaceSummary(membership.workspace),
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    },
  };
}

export async function checkSlugAvailability(
  slugInput: SlugAvailabilityQueryInput['slug'],
): Promise<{ slug: string; available: boolean }> {
  const slug = normalizeSlug(slugInput);
  // Re-validate format by parsing through schema transform? Use direct regex.
  if (
    slug.length < 3 ||
    slug.length > 48 ||
    !/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(slug) ||
    slug.includes('--')
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid slug');
  }

  const existing = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });

  return { slug, available: !existing };
}

/** Serializes sensitive workspace writes by locking the workspace row. */
async function lockWorkspaceRow(tx: Prisma.TransactionClient, workspaceId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`;
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  actorUserId: string,
  input: UpdateWorkspaceSettingsInput,
): Promise<WorkspaceSummary> {
  // Early check so unauthorized/non-member requests do not take a row lock.
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canManageWorkspaceSettings(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  if (input.slug !== undefined && !canChangeSlug(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can change the workspace slug');
  }

  const data: Prisma.WorkspaceUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.description !== undefined) {
    const description = input.description?.trim();
    data.description = description && description.length > 0 ? description : null;
  }
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;

  try {
    return await prisma.$transaction(async (tx) => {
      await lockWorkspaceRow(tx, workspaceId);
      const current = await tx.workspaceMembership.findFirst({
        where: { workspaceId, userId: actorUserId, status: 'ACTIVE' },
        select: { role: true },
      });
      if (!current) {
        throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
      }
      if (!canManageWorkspaceSettings(current.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Forbidden');
      }
      if (input.slug !== undefined && !canChangeSlug(current.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Only the owner can change the workspace slug');
      }

      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data,
        select: workspaceSelect,
      });
      return toWorkspaceSummary(updated);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'WORKSPACE_SLUG_TAKEN', 'A workspace with this slug already exists');
    }
    throw error;
  }
}

export interface TransferOwnershipResult {
  workspace: WorkspaceSummary;
  membership: {
    id: string;
    userId: string;
    role: 'OWNER';
    status: 'ACTIVE';
  };
}

export async function transferOwnership(
  workspaceId: string,
  actorUserId: string,
  input: TransferOwnershipInput,
): Promise<TransferOwnershipResult> {
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canTransferOwnership(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { passwordHash: true },
  });
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }
  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }

  return prisma.$transaction(async (tx) => {
    await lockWorkspaceRow(tx, workspaceId);
    const currentActor = await tx.workspaceMembership.findFirst({
      where: { workspaceId, userId: actorUserId, status: 'ACTIVE' },
      select: { id: true, role: true },
    });
    if (!currentActor || !canTransferOwnership(currentActor.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    }

    const target = await tx.workspaceMembership.findFirst({
      where: { id: input.targetMembershipId, workspaceId },
      select: { id: true, userId: true, role: true, status: true },
    });
    if (!target) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found');
    }
    if (target.userId === actorUserId) {
      throw new AppError(409, 'CANNOT_TRANSFER_TO_SELF', 'Cannot transfer ownership to yourself');
    }
    if (target.status !== 'ACTIVE') {
      throw new AppError(409, 'MEMBER_NOT_ACTIVE', 'Target member is not active');
    }
    if (target.role === 'OWNER') {
      throw new AppError(409, 'ALREADY_OWNER', 'Target member is already an owner');
    }

    await tx.workspaceMembership.update({
      where: { id: target.id },
      data: { role: 'OWNER' },
    });
    await tx.workspaceMembership.update({
      where: { id: currentActor.id },
      data: { role: 'ADMIN' },
    });

    const ownerCount = await tx.workspaceMembership.count({
      where: { workspaceId, role: 'OWNER', status: 'ACTIVE' },
    });
    if (ownerCount < 1) {
      throw new AppError(409, 'OWNERLESS_WORKSPACE', 'Workspace must retain an active owner');
    }

    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: workspaceSelect,
    });
    if (!workspace) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }

    return {
      workspace: toWorkspaceSummary(workspace),
      membership: {
        id: target.id,
        userId: target.userId,
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
      },
    };
  });
}
