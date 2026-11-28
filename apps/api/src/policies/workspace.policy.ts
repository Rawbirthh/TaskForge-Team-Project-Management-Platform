export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export const WORKSPACE_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'];

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  GUEST: 1,
};

export function canReadWorkspace(_role: WorkspaceRole): boolean {
  return true;
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canInviteRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (targetRole === 'OWNER') return false;
  if (actorRole === 'OWNER') {
    return targetRole === 'ADMIN' || targetRole === 'MEMBER' || targetRole === 'GUEST';
  }
  if (actorRole === 'ADMIN') {
    return targetRole === 'MEMBER' || targetRole === 'GUEST';
  }
  return false;
}

export function canChangeRole(
  actorRole: WorkspaceRole,
  targetCurrentRole: WorkspaceRole,
  targetNewRole: WorkspaceRole,
): boolean {
  if (targetNewRole === 'OWNER') return false;
  if (actorRole === 'OWNER') {
    // Owner can change any member's role, including demoting another owner,
    // subject to last-owner protection enforced by the caller.
    return targetNewRole === 'ADMIN' || targetNewRole === 'MEMBER' || targetNewRole === 'GUEST';
  }
  if (actorRole === 'ADMIN') {
    if (targetCurrentRole !== 'MEMBER' && targetCurrentRole !== 'GUEST') return false;
    return targetNewRole === 'MEMBER' || targetNewRole === 'GUEST';
  }
  return false;
}

export function canSuspendOrRemove(
  actorRole: WorkspaceRole,
  targetCurrentRole: WorkspaceRole,
  isSelf: boolean,
): boolean {
  if (actorRole === 'OWNER') {
    // Owner can act on anyone except the last owner is handled by caller via count check.
    return true;
  }
  if (actorRole === 'ADMIN') {
    return targetCurrentRole === 'MEMBER' || targetCurrentRole === 'GUEST';
  }
  // Members/guests may only remove themselves (leave), not suspend others.
  return isSelf && targetCurrentRole !== 'OWNER';
}

export function isLastOwnerProtected(targetRole: WorkspaceRole, activeOwnerCount: number): boolean {
  return targetRole === 'OWNER' && activeOwnerCount <= 1;
}

export function roleRank(role: WorkspaceRole): number {
  return ROLE_RANK[role];
}
