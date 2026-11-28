import { ApiError } from '@/lib/api-client';
import type { EditableProjectStatus, ProjectVisibility } from '@/types/project';

export interface ProjectFormValues {
  key: string;
  name: string;
  description: string;
  visibility: ProjectVisibility;
  startDate: string;
  targetDate: string;
  status: EditableProjectStatus;
}

export const emptyProjectFormValues: ProjectFormValues = {
  key: '',
  name: '',
  description: '',
  visibility: 'WORKSPACE',
  startDate: '',
  targetDate: '',
  status: 'ACTIVE',
};

export function getProjectFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const details = Array.isArray(error.details) ? (error.details as unknown[]) : [];
  const errors: Record<string, string> = {};
  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue;
    const item = detail as { path?: unknown; message?: unknown };
    if (typeof item.path === 'string' && typeof item.message === 'string') {
      errors[item.path] = item.message;
    }
  }
  return errors;
}

export function getProjectErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return Object.values(getProjectFieldErrors(error))[0] ?? error.message;
  }
  return fallback;
}
