import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { UpdateMemberInput, MemberListQueryInput } from '../schemas/membership.schemas.js';
import {
  canChangeRole,
  canManageMembers,
  canReadWorkspace,
  canSuspendOrRemove,
  isLastOwnerProtected,
} from '../policies/workspace.policy.js';

export interface MembershipSummary {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberListItem {
  membership: MembershipSummary;
  user: { id: string; displayName: string; email: string };
}

export interface MemberListResult {
  items: MemberListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ActiveMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
}

export async function getActiveMembership(
  workspaceId: string,
  userId: string,
): Promise<ActiveMembership> {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, userId, status: 'ACTIVE' },
    select: { id: true, workspaceId: true, userId: true, role: true, status: true },
  });
  if (!membership) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }
  return membership;
}

export async function assertWorkspaceExists(workspaceId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }
}

export async function listMembers(
  workspaceId: string,
  actorUserId: string,
  query: MemberListQueryInput,
): Promise<MemberListResult> {
  const actor = await getActiveMembership(workspaceId, actorUserId);
  if (!canReadWorkspace(actor.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where: {
    workspaceId: string;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
    status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
    user?: { OR: Array<{ displayName?: { contains: string }; email?: { contains: string } }> };
  } = { workspaceId };

  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  if (query.q) {
    where.user = {
      OR: [{ displayName: { contains: query.q } }, { email: { contains: query.q } }],
    };
  }

  const [memberships, total] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where,
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.workspaceMembership.count({ where }),
  ]);

  const items: MemberListItem[] = memberships.map((m) => ({
    membership: {
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    },
    user: { id: m.user.id, displayName: m.user.displayName, email: m.user.email },
  }));

  return { items, page, limit, total };
}

export async function countActiveOwners(workspaceId: string): Promise<number> {
  return prisma.workspaceMembership.count({
    where: { workspaceId, role: 'OWNER', status: 'ACTIVE' },
  });
}

export async function updateMember(
  workspaceId: string,
  actorUserId: string,
  membershipId: string,
  input: UpdateMemberInput,
): Promise<MembershipSummary> {
  const actor = await getActiveMembership(workspaceId, actorUserId);

  const updated = await prisma.$transaction(async (tx) => {
    const target = await tx.workspaceMembership.findFirst({
      where: { id: membershipId, workspaceId },
      select: { id: true, userId: true, role: true, status: true },
    });
    if (!target) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found');
    }

    if (target.status === 'REMOVED') {
      throw new AppError(409, 'MEMBER_REMOVED', 'Removed members must be re-invited');
    }

    const isSelf = target.userId === actorUserId;

    if (input.role !== undefined) {
      if (!canChangeRole(actor.role, target.role, input.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Forbidden');
      }
      const activeOwners = await tx.workspaceMembership.count({
        where: { workspaceId, role: 'OWNER', status: 'ACTIVE' },
      });
      if (isLastOwnerProtected(target.role, activeOwners)) {
        throw new AppError(409, 'LAST_OWNER_PROTECTED', 'Cannot modify the last owner');
      }
    }

    if (input.status !== undefined) {
      if (input.status === 'SUSPENDED') {
        if (!canSuspendOrRemove(actor.role, target.role, isSelf)) {
          throw new AppError(403, 'FORBIDDEN', 'Forbidden');
        }
        const activeOwners = await tx.workspaceMembership.count({
          where: { workspaceId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (isLastOwnerProtected(target.role, activeOwners)) {
          throw new AppError(409, 'LAST_OWNER_PROTECTED', 'Cannot modify the last owner');
        }
      } else {
        // reactivation: respect target-role boundary.
        if (!canSuspendOrRemove(actor.role, target.role, isSelf)) {
          throw new AppError(403, 'FORBIDDEN', 'Forbidden');
        }
      }
    }

    if (isSelf && input.role !== undefined && !canManageMembers(actor.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    }

    const data: { role?: 'ADMIN' | 'MEMBER' | 'GUEST'; status?: 'ACTIVE' | 'SUSPENDED' } = {};
    if (input.role !== undefined) data.role = input.role;
    if (input.status !== undefined) data.status = input.status;

    const result = await tx.workspaceMembership.update({
      where: { id: membershipId },
      data,
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      id: result.id,
      userId: result.userId,
      role: result.role,
      status: result.status,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  });

  return updated;
}

export async function removeMember(
  workspaceId: string,
  actorUserId: string,
  membershipId: string,
): Promise<void> {
  const actor = await getActiveMembership(workspaceId, actorUserId);

  await prisma.$transaction(async (tx) => {
    const target = await tx.workspaceMembership.findFirst({
      where: { id: membershipId, workspaceId },
      select: { id: true, userId: true, role: true, status: true },
    });
    if (!target) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found');
    }

    const isSelf = target.userId === actorUserId;

    if (!canSuspendOrRemove(actor.role, target.role, isSelf)) {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    }

    const activeOwners = await tx.workspaceMembership.count({
      where: { workspaceId, role: 'OWNER', status: 'ACTIVE' },
    });
    if (isLastOwnerProtected(target.role, activeOwners)) {
      throw new AppError(409, 'LAST_OWNER_PROTECTED', 'Cannot remove the last owner');
    }

    if (target.status === 'REMOVED') {
      return;
    }

    await tx.workspaceMembership.update({
      where: { id: membershipId },
      data: { status: 'REMOVED' },
    });
  });
}
