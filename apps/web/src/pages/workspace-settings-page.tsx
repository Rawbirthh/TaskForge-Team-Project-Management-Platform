import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelectedWorkspace } from '@/features/workspaces/selected-workspace-context';
import {
  getWorkspace,
  transferOwnership,
  updateWorkspace,
} from '@/features/workspaces/workspace-api';
import { listMembers } from '@/features/workspaces/membership-api';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/page-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const details = Array.isArray(error.details) ? error.details : [];
    const first = details.find((detail) => detail && typeof detail === 'object') as
      { message?: unknown } | undefined;
    if (first && typeof first.message === 'string') return first.message;
    return error.message;
  }
  return fallback;
}

export function WorkspaceSettingsPage() {
  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useSelectedWorkspace();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (routeWorkspaceId && routeWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(routeWorkspaceId);
    }
  }, [routeWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId]);

  const workspaceId = routeWorkspaceId ?? selectedWorkspaceId ?? undefined;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [targetMembershipId, setTargetMembershipId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [transferSearch, setTransferSearch] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const transferMembersQuery = useQuery({
    queryKey: ['workspace-transfer-members', workspaceId, transferSearch],
    queryFn: () => {
      const filters: Parameters<typeof listMembers>[3] = {};
      if (transferSearch) filters.q = transferSearch;
      return listMembers(workspaceId!, 1, 50, filters);
    },
    enabled: Boolean(workspaceId) && transferOpen,
    // Keep the previous results while a new search loads so the dialog height
    // stays stable while the owner types in the search field.
    placeholderData: (previousData) => previousData,
  });

  const workspace = workspaceQuery.data?.workspace;
  const currentRole = workspaceQuery.data?.membership.role;
  const isOwner = currentRole === 'OWNER';
  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN';

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setSlug(workspace.slug);
    setDescription(workspace.description ?? '');
    setLogoUrl(workspace.logoUrl ?? '');
  }, [workspace]);

  if (!workspaceId) {
    return (
      <ErrorState title="Missing workspace" description="Open a workspace from the dashboard." />
    );
  }

  if (workspaceQuery.isLoading) {
    return <LoadingState label="Loading workspace settings…" />;
  }

  if (workspaceQuery.isError || !workspace) {
    return (
      <ErrorState
        title="Failed to load workspace"
        description="This workspace may be unavailable or you may not have access."
        onRetry={() => void workspaceQuery.refetch()}
      />
    );
  }

  if (!canManage) {
    return (
      <ErrorState
        title="Permission denied"
        description="Only workspace owners and admins can manage settings."
      />
    );
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError(null);
    setIsSaving(true);
    try {
      await updateWorkspace(workspaceId!, {
        name,
        ...(isOwner ? { slug } : {}),
        description: description.trim() ? description : null,
        logoUrl: logoUrl.trim() ? logoUrl : null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      ]);
      toast.success('Workspace settings saved.');
    } catch (error) {
      const message = errorMessage(error, 'Failed to save settings.');
      setSettingsError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTransfer() {
    if (!targetMembershipId) {
      setTransferError('Select a new owner.');
      return;
    }
    if (!currentPassword) {
      setTransferError('Enter your current password.');
      return;
    }
    setTransferError(null);
    setIsTransferring(true);
    try {
      await transferOwnership(workspaceId!, {
        targetMembershipId,
        currentPassword,
      });
      setTransferOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
      ]);
      toast.success('Ownership transferred.');
    } catch (error) {
      const message = errorMessage(error, 'Failed to transfer ownership.');
      setTransferError(message);
      toast.error(message);
    } finally {
      setCurrentPassword('');
      setIsTransferring(false);
    }
  }

  const transferCandidates =
    transferMembersQuery.data?.items.filter(
      (item) => item.membership.status === 'ACTIVE' && item.membership.role !== 'OWNER',
    ) ?? [];

  return (
    <div className="space-y-6">
      <nav aria-label="Workspace settings sections" className="flex flex-wrap gap-3 text-sm">
        <span className="font-medium text-ink" aria-current="page">
          General
        </span>
        <Link className="text-brand hover:underline" to={`/app/workspaces/${workspaceId}/members`}>
          Members
        </Link>
        <Link
          className="text-brand hover:underline"
          to={`/app/workspaces/${workspaceId}/members#invitations`}
        >
          Invitations
        </Link>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>General settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="max-w-xl space-y-4">
            <div className="space-y-1">
              <label htmlFor="workspace-name" className="text-sm font-medium text-ink">
                Name
              </label>
              <Input
                id="workspace-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                disabled={isSaving}
              />
            </div>
            {isOwner ? (
              <div className="space-y-1">
                <label htmlFor="workspace-slug" className="text-sm font-medium text-ink">
                  Slug
                </label>
                <Input
                  id="workspace-slug"
                  value={slug}
                  maxLength={48}
                  onChange={(event) => setSlug(event.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted">Used in workspace links. Owner only.</p>
              </div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="workspace-description" className="text-sm font-medium text-ink">
                Description
              </label>
              <textarea
                id="workspace-description"
                value={description}
                maxLength={500}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSaving}
                className="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="workspace-logo" className="text-sm font-medium text-ink">
                Logo URL
              </label>
              <Input
                id="workspace-logo"
                type="url"
                value={logoUrl}
                maxLength={500}
                placeholder="https://example.com/logo.png"
                onChange={(event) => setLogoUrl(event.target.value)}
                disabled={isSaving}
              />
              <p className="text-xs text-muted">A public image URL. File upload is added later.</p>
            </div>
            {settingsError ? <p className="text-danger text-sm">{settingsError}</p> : null}
            <Button type="submit" isLoading={isSaving}>
              Save settings
            </Button>
          </form>
          <dl className="mt-6 border-t border-line pt-4 text-xs text-muted">
            <div className="flex gap-2">
              <dt>Created:</dt>
              <dd>{new Date(workspace.createdAt).toLocaleString()}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Last updated:</dt>
              <dd>{new Date(workspace.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer ownership</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted">
              Transfer ownership to another active member. You will become an admin.
            </p>
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              Transfer ownership
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              Confirm with your current password. This takes effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Absorb browser/password-manager autofill so the visible fields stay empty. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
            >
              <input type="text" autoComplete="username" tabIndex={-1} />
              <input type="password" autoComplete="current-password" tabIndex={-1} />
            </div>
            <div className="space-y-1">
              <label htmlFor="transfer-search" className="text-sm font-medium text-ink">
                Find a member
              </label>
              <Input
                id="transfer-search"
                name="workspace-member-search"
                value={transferSearch}
                maxLength={100}
                placeholder="Search by name or email"
                onChange={(event) => setTransferSearch(event.target.value)}
                onFocus={(event) => {
                  if (transferSearch === '' && event.target.value !== '') event.target.value = '';
                }}
                disabled={isTransferring}
                autoComplete="off"
                data-form-type="other"
              />
              <p className="min-h-4 text-xs text-muted" aria-live="polite">
                {transferMembersQuery.isFetching ? 'Searching…' : ''}
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="transfer-target" className="text-sm font-medium text-ink">
                New owner
              </label>
              <select
                id="transfer-target"
                value={targetMembershipId}
                onChange={(event) => setTargetMembershipId(event.target.value)}
                disabled={isTransferring}
                className="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm"
              >
                <option value="">Select a member…</option>
                {transferCandidates.map((item) => (
                  <option key={item.membership.id} value={item.membership.id}>
                    {item.user.displayName} ({item.user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="transfer-password" className="text-sm font-medium text-ink">
                Current password
              </label>
              <Input
                id="transfer-password"
                name="workspace-ownership-password"
                type="password"
                value={currentPassword}
                placeholder="Enter your current password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                onFocus={(event) => {
                  if (currentPassword === '' && event.target.value !== '') event.target.value = '';
                }}
                disabled={isTransferring}
                autoComplete="new-password"
                data-form-type="other"
              />
            </div>
            {transferError ? <p className="text-danger text-sm">{transferError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setTransferOpen(false)}
              disabled={isTransferring}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleTransfer()} isLoading={isTransferring}>
              Confirm transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
