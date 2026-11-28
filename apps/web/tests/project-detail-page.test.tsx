import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetailPage } from '@/pages/project-detail-page';
import { SelectedWorkspaceProvider } from '@/features/workspaces/selected-workspace-context';
import {
  archiveProject,
  getProject,
  restoreProject,
  updateProject,
} from '@/features/projects/project-api';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import { ApiError } from '@/lib/api-client';
import type { ProjectSummary } from '@/types/project';

vi.mock('@/features/projects/project-api', () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  restoreProject: vi.fn(),
}));

vi.mock('@/features/workspaces/workspace-api', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getProjectMock = vi.mocked(getProject);
const updateProjectMock = vi.mocked(updateProject);
const archiveProjectMock = vi.mocked(archiveProject);
const restoreProjectMock = vi.mocked(restoreProject);
const getWorkspaceMock = vi.mocked(getWorkspace);

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  const base: ProjectSummary = {
    id: 'p1',
    workspaceId: 'ws_1',
    key: 'ALPHA',
    name: 'Alpha Project',
    description: null,
    visibility: 'WORKSPACE',
    status: 'ACTIVE',
    startDate: '2026-01-02',
    targetDate: '2026-02-03',
    createdBy: { id: 'u1', displayName: 'Ada' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    archivedAt: null,
  };
  return { ...base, ...overrides };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/app/projects/:projectId', element: <ProjectDetailPage /> }],
    {
      initialEntries: ['/app/projects/p1'],
    },
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
  window.localStorage.setItem('taskforge:selectedWorkspaceId', 'ws_1');
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
    membership: { id: 'm1', role: 'OWNER', status: 'ACTIVE' },
  });
  getProjectMock.mockResolvedValue({ project: project() });
  updateProjectMock.mockResolvedValue({ project: project({ name: 'Renamed' }) });
  archiveProjectMock.mockResolvedValue({ project: project({ status: 'ARCHIVED' }) });
  restoreProjectMock.mockResolvedValue({ project: project() });
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('project detail page', () => {
  it('hides edit and lifecycle actions from members', async () => {
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
      membership: { id: 'm2', role: 'MEMBER', status: 'ACTIVE' },
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Alpha Project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('archives and restores through the lifecycle actions', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Archive' });

    // The next getProject call is the post-mutation refetch triggered by invalidation.
    getProjectMock.mockResolvedValueOnce({
      project: project({ status: 'ARCHIVED', archivedAt: '2026-01-03T00:00:00.000Z' }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archiveProjectMock).toHaveBeenCalledWith('ws_1', 'p1'));

    expect(await screen.findByText('This project is archived and read-only.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore project' }));
    await waitFor(() => expect(restoreProjectMock).toHaveBeenCalledWith('ws_1', 'p1'));
  });

  it('saves details with calendar-date strings and shows API field errors', async () => {
    renderPage();
    await screen.findByLabelText('Name');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => {
      expect(updateProjectMock).toHaveBeenCalledWith('ws_1', 'p1', {
        name: 'Renamed',
        visibility: 'WORKSPACE',
        status: 'ACTIVE',
        description: null,
        startDate: '2026-01-02',
        targetDate: '2026-02-03',
      });
    });

    updateProjectMock.mockRejectedValueOnce(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
        details: [
          {
            path: 'targetDate',
            message: 'Target date must not precede start date',
            code: 'custom',
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    expect(
      (await screen.findAllByText('Target date must not precede start date')).length,
    ).toBeGreaterThan(0);
  });
});
