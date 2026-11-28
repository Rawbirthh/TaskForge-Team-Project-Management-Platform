import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectCreatePage } from '@/pages/project-create-page';
import { SelectedWorkspaceProvider } from '@/features/workspaces/selected-workspace-context';
import { createProject } from '@/features/projects/project-api';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import { ApiError } from '@/lib/api-client';

vi.mock('@/features/projects/project-api', () => ({
  createProject: vi.fn(),
}));

vi.mock('@/features/workspaces/workspace-api', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const createProjectMock = vi.mocked(createProject);
const getWorkspaceMock = vi.mocked(getWorkspace);

function renderPage(initialEntry = '/app/projects/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/app/projects/new', element: <ProjectCreatePage /> }],
    {
      initialEntries: [initialEntry],
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
  createProjectMock.mockResolvedValue({
    project: {
      id: 'p1',
      workspaceId: 'ws_1',
      key: 'ALPHA',
      name: 'Alpha Project',
      description: null,
      visibility: 'WORKSPACE',
      status: 'ACTIVE',
      startDate: null,
      targetDate: null,
      createdBy: { id: 'u1', displayName: 'Ada' },
      createdAt: '',
      updatedAt: '',
      archivedAt: null,
    },
  });
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('project create page', () => {
  it('submits dates as calendar-date strings and disables the button while pending', async () => {
    let resolveCreate: ((value: Awaited<ReturnType<typeof createProject>>) => void) | undefined;
    createProjectMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    renderPage();
    await screen.findByLabelText('Name');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpha Project' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-02' } });
    fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-02-03' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(createProjectMock).toHaveBeenCalledWith('ws_1', {
      key: 'alpha',
      name: 'Alpha Project',
      visibility: 'WORKSPACE',
      status: 'ACTIVE',
      startDate: '2026-01-02',
      targetDate: '2026-02-03',
    });

    resolveCreate?.({
      project: {
        id: 'p1',
        workspaceId: 'ws_1',
        key: 'ALPHA',
        name: 'Alpha Project',
        description: null,
        visibility: 'WORKSPACE',
        status: 'ACTIVE',
        startDate: null,
        targetDate: null,
        createdBy: { id: 'u1', displayName: 'Ada' },
        createdAt: '',
        updatedAt: '',
        archivedAt: null,
      },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create project' })).toBeEnabled();
    });
  });

  it('renders field-level validation errors returned by the API', async () => {
    createProjectMock.mockRejectedValueOnce(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
        details: [{ path: 'key', message: 'Key is already taken', code: 'custom' }],
      }),
    );

    renderPage();
    await screen.findByLabelText('Name');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpha Project' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'ALPHA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect((await screen.findAllByText('Key is already taken')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
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
      membership: { id: 'm2', role: 'MEMBER', status: 'ACTIVE' },
    });

    renderPage();

    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('uses a workspaceId from the URL when there is no stored selection', async () => {
    window.localStorage.removeItem('taskforge:selectedWorkspaceId');
    renderPage('/app/projects/new?workspaceId=ws_2');

    await screen.findByLabelText('Name');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Deep Link Project' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'DEEP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith('ws_2', {
        key: 'DEEP',
        name: 'Deep Link Project',
        visibility: 'WORKSPACE',
        status: 'ACTIVE',
      });
    });
  });
});
