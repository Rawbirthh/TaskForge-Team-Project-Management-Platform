import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from '@/pages/projects-page';
import { SelectedWorkspaceProvider } from '@/features/workspaces/selected-workspace-context';
import { listProjects } from '@/features/projects/project-api';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import type { ProjectSummary } from '@/types/project';

vi.mock('@/features/projects/project-api', () => ({
  listProjects: vi.fn(),
}));

vi.mock('@/features/workspaces/workspace-api', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const listProjectsMock = vi.mocked(listProjects);
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
    startDate: null,
    targetDate: '2026-12-31',
    createdBy: { id: 'u1', displayName: 'Ada' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    archivedAt: null,
  };
  return { ...base, ...overrides };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/app/projects', element: <ProjectsPage /> }], {
    initialEntries: ['/app/projects'],
  });
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
  listProjectsMock.mockResolvedValue({ items: [project()], page: 1, limit: 20, total: 1 });
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('projects page', () => {
  it('renders project rows with status/visibility badges and a create action for owners', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Alpha Project' })).toBeInTheDocument();
    expect(screen.getByText('ALPHA')).toBeInTheDocument();
    expect(screen.getByText('2026-12-31')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Workspace').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'New project' })).toBeInTheDocument();
  });

  it('hides create actions for members while still showing the list', async () => {
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

    expect(await screen.findByRole('link', { name: 'Alpha Project' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New project' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no projects', async () => {
    listProjectsMock.mockResolvedValueOnce({ items: [], page: 1, limit: 20, total: 0 });
    renderPage();
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('applies filters through the API with allowlisted values', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Alpha Project' });

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PAUSED' } });
    fireEvent.change(screen.getByLabelText('Visibility'), { target: { value: 'PRIVATE' } });

    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenLastCalledWith('ws_1', {
        page: 1,
        limit: 20,
        q: 'alpha',
        status: 'PAUSED',
        visibility: 'PRIVATE',
      });
    });
  });

  it('offers a retry action when the list request fails', async () => {
    listProjectsMock.mockRejectedValueOnce(new Error('network'));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
