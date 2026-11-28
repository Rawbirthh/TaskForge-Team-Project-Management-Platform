import { Badge } from '@/components/ui/badge';
import type { ProjectStatus, ProjectVisibility } from '@/types/project';

const statusVariants: Record<ProjectStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'info',
  ARCHIVED: 'neutral',
};

const statusLabels: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>;
}

const visibilityLabels: Record<ProjectVisibility, string> = {
  WORKSPACE: 'Workspace',
  PRIVATE: 'Private',
};

export function ProjectVisibilityBadge({ visibility }: { visibility: ProjectVisibility }) {
  return (
    <Badge variant={visibility === 'PRIVATE' ? 'warning' : 'neutral'}>
      {visibilityLabels[visibility]}
    </Badge>
  );
}
