import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSettingsPage } from '@/pages/workspace-settings-page';
import { SelectedWorkspaceProvider } from '@/features/workspaces/selected-workspace-context';
import {
  getWorkspace,
  transferOwnership,
  updateWorkspace,
} from '@/features/workspaces/workspace-api';
import { listMembers } from '@/features/workspaces/membership-api';

vi.mock('@/features/workspaces/workspace-api', () => ({
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  transferOwnership: vi.fn(),
}));

vi.mock('@/features/workspaces/membership-api', () => ({
  listMembers: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getWorkspaceMock = vi.mocked(getWorkspace);
const updateWorkspaceMock = vi.mocked(updateWorkspace);
const transferOwnershipMock = vi.mocked(transferOwnership);
const listMembersMock = vi.mocked(listMembers);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/app/workspaces/:workspaceId/settings', element: <WorkspaceSettingsPage /> }],
    { initialEntries: ['/app/workspaces/ws_1/settings'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <SelectedWorkspaceProvider>
        <RouterProvider router={router} />
      </SelectedWorkspaceProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getWorkspaceMock.mockResolvedValue({
    workspace: {
      id: 'ws_1',
      name: 'Acme',
      slug: 'acme',
      description: null,
      logoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    membership: { id: 'mem_1', role: 'OWNER', status: 'ACTIVE' },
  });
  listMembersMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
  updateWorkspaceMock.mockResolvedValue({
    workspace: {
      id: 'ws_1',
      name: 'Acme',
      slug: 'acme',
      description: null,
      logoUrl: null,
      createdAt: '',
      updatedAt: '',
    },
  });
  transferOwnershipMock.mockResolvedValue({
    workspace: {
      id: 'ws_1',
      name: 'Acme',
      slug: 'acme',
      description: null,
      logoUrl: null,
      createdAt: '',
      updatedAt: '',
    },
    membership: { id: 'mem_2', userId: 'u2', role: 'OWNER', status: 'ACTIVE' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('workspace settings page', () => {
  it('shows the slug field for owners and saves settings', async () => {
    renderPage();

    expect(await screen.findByLabelText('Slug')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(updateWorkspaceMock).toHaveBeenCalledWith('ws_1', {
        name: 'Renamed',
        slug: 'acme',
        description: null,
        logoUrl: null,
      });
    });
  });

  it('shows a permission-denied state for members', async () => {
    getWorkspaceMock.mockResolvedValue({
      workspace: {
        id: 'ws_1',
        name: 'Acme',
        slug: 'acme',
        description: null,
        logoUrl: null,
        createdAt: '',
        updatedAt: '',
      },
      membership: { id: 'mem_1', role: 'MEMBER', status: 'ACTIVE' },
    });

    renderPage();

    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('hides the slug field and ownership transfer for admins', async () => {
    getWorkspaceMock.mockResolvedValue({
      workspace: {
        id: 'ws_1',
        name: 'Acme',
        slug: 'acme',
        description: null,
        logoUrl: null,
        createdAt: '',
        updatedAt: '',
      },
      membership: { id: 'mem_1', role: 'ADMIN', status: 'ACTIVE' },
    });

    renderPage();

    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer ownership' })).not.toBeInTheDocument();
  });

  it('requests a password before confirming ownership transfer', async () => {
    listMembersMock.mockResolvedValue({
      items: [
        {
          membership: {
            id: 'mem_2',
            userId: 'u2',
            role: 'MEMBER',
            status: 'ACTIVE',
            createdAt: '',
            updatedAt: '',
          },
          user: { id: 'u2', displayName: 'Next Owner', email: 'next@example.com' },
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Next Owner/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New owner'), { target: { value: 'mem_2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }));
    expect(transferOwnershipMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'password123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }));

    await waitFor(() => {
      expect(transferOwnershipMock).toHaveBeenCalledWith('ws_1', {
        targetMembershipId: 'mem_2',
        currentPassword: 'password123456',
      });
    });
  });
});
