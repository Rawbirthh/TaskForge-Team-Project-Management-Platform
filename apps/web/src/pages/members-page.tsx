import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useSelectedWorkspace } from '@/features/workspaces/selected-workspace-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  createInvitation,
  listInvitations,
  listMembers,
  removeMember,
  resendInvitation,
  revokeInvitation,
  updateMember,
} from '@/features/workspaces/membership-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function MembersPage() {
  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useSelectedWorkspace();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'GUEST' | 'ADMIN'>('MEMBER');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  // Keep the selected workspace in sync with the route (deep links / switches).
  useEffect(() => {
    if (routeWorkspaceId && routeWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(routeWorkspaceId);
    }
  }, [routeWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId]);

  const workspaceId = routeWorkspaceId ?? selectedWorkspaceId ?? undefined;

  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => listMembers(workspaceId!, 1, 50),
    enabled: Boolean(workspaceId),
  });

  const invitationsQuery = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: () => listInvitations(workspaceId!, 1, 50),
    enabled: Boolean(workspaceId),
  });

  // Resolve the current user's role from the workspace detail endpoint, which is
  // reliable (avoids fragile id-matching against the paginated member list).
  const workspaceDetailQuery = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const currentRole = workspaceDetailQuery.data?.membership.role;
  const isOwner = currentRole === 'OWNER';
  const canChangeRole = currentRole === 'OWNER' || currentRole === 'ADMIN';

  if (!workspaceId) {
    return <p className="text-danger">Missing workspace.</p>;
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    const email = inviteEmail.trim();
    if (!email) {
      const msg = 'Email is required.';
      setInviteError(msg);
      toast.error(msg);
      return;
    }
    setIsInviting(true);
    try {
      await createInvitation(workspaceId!, { email, role: inviteRole });
      setInviteEmail('');
      await queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] });
      toast.success('Invitation sent.');
    } catch (error) {
      if (error instanceof ApiError) {
        const details = Array.isArray(error.details) ? error.details : [];
        let msg = error.message;
        const first = details.find((d) => d && typeof d === 'object') as
          { message?: unknown } | undefined;
        if (first && typeof first.message === 'string') msg = first.message;
        setInviteError(msg);
        toast.error(msg);
      } else {
        setInviteError('Failed to invite.');
        toast.error('Failed to invite.');
      }
    } finally {
      setIsInviting(false);
    }
  }

  async function handleChangeRole(membershipId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') {
    try {
      await updateMember(workspaceId!, membershipId, { role });
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      toast.success('Role updated.');
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
      else toast.error('Failed to update role.');
    }
  }

  async function handleRemove(membershipId: string) {
    try {
      await removeMember(workspaceId!, membershipId);
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Member removed.');
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
      else toast.error('Failed to remove member.');
    }
  }

  async function handleResend(invitationId: string) {
    try {
      await resendInvitation(workspaceId!, invitationId);
      await queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] });
      toast.success('Invitation resent.');
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
      else toast.error('Failed to resend invitation.');
    }
  }

  async function handleRevoke(invitationId: string) {
    try {
      await revokeInvitation(workspaceId!, invitationId);
      await queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] });
      toast.success('Invitation revoked.');
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
      else toast.error('Failed to revoke invitation.');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersQuery.isLoading ? (
            <p className="text-muted">Loading members…</p>
          ) : membersQuery.isError ? (
            <p className="text-danger">Failed to load members.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {membersQuery.data?.items.map((m) => (
                    <tr key={m.membership.id} className="border-t border-line">
                      <td className="py-2">{m.user.displayName}</td>
                      <td className="py-2">{m.user.email}</td>
                      <td className="py-2">{m.membership.role}</td>
                      <td className="py-2">{m.membership.status}</td>
                      <td className="py-2">
                        {canChangeRole ? (
                          <>
                            <select
                              aria-label={`Change role for ${m.user.displayName}`}
                              value={m.membership.role === 'OWNER' ? 'OWNER' : m.membership.role}
                              disabled={m.membership.role === 'OWNER'}
                              onChange={(e) =>
                                handleChangeRole(
                                  m.membership.id,
                                  e.target.value as 'ADMIN' | 'MEMBER' | 'GUEST',
                                )
                              }
                            >
                              {m.membership.role !== 'OWNER' ? (
                                <>
                                  <option value="ADMIN">Admin</option>
                                  <option value="MEMBER">Member</option>
                                  <option value="GUEST">Guest</option>
                                </>
                              ) : (
                                <option value="OWNER">Owner</option>
                              )}
                            </select>
                            {m.membership.role !== 'OWNER' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleRemove(m.membership.id)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {membersQuery.data?.items.length === 0 ? (
                <p className="text-muted">No members.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label htmlFor="invite-email" className="text-sm font-medium text-ink">
                  Email
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isInviting}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="invite-role" className="text-sm font-medium text-ink">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER' | 'GUEST')}
                  disabled={isInviting}
                  className="rounded-md border border-line bg-surface px-2 py-2 text-sm"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest</option>
                </select>
              </div>
              <Button type="submit" isLoading={isInviting}>
                Invite
              </Button>
            </form>
            {inviteError ? <p className="text-danger text-sm">{inviteError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            {invitationsQuery.isLoading ? (
              <p className="text-muted">Loading invitations…</p>
            ) : invitationsQuery.isError ? (
              <p className="text-danger">Failed to load invitations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-2">Email</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitationsQuery.data?.items.map((inv) => (
                      <tr key={inv.id} className="border-t border-line">
                        <td className="py-2">{inv.email}</td>
                        <td className="py-2">{inv.role}</td>
                        <td className="py-2">{inv.status}</td>
                        <td className="py-2">
                          {isOwner && inv.status === 'PENDING' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleResend(inv.id)}
                              >
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleRevoke(inv.id)}
                              >
                                Revoke
                              </Button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {invitationsQuery.data?.items.length === 0 ? (
                  <p className="text-muted">No invitations.</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
