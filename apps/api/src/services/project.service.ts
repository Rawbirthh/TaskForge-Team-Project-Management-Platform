import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { Prisma, type ProjectStatus, type ProjectVisibility } from '../generated/prisma/client.js';
import { getActiveMembership, type ActiveMembership } from './membership.service.js';
import {
  canArchiveProject,
  canManageProject,
  canReadProject,
  canRestoreProject,
} from '../policies/workspace.policy.js';
import type {
  CreateProjectInput,
  ProjectListQueryInput,
  UpdateProjectInput,
} from '../schemas/project.schemas.js';

const projectSelect = {
  id: true,
  workspaceId: true,
  key: true,
  name: true,
  description: true,
  visibility: true,
  status: true,
  startDate: true,
  targetDate: true,
  createdByUserId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, displayName: true } },
} as const;

interface ProjectRow {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  startDate: Date | null;
  targetDate: Date | null;
  createdByUserId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; displayName: string };
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ProjectListResult {
  items: ProjectDto[];
  page: number;
  limit: number;
  total: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateOnly(value: Date | null): string | null {
  if (value === null) return null;
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toProjectDto(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    key: row.key,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    startDate: toDateOnly(row.startDate),
    targetDate: toDateOnly(row.targetDate),
    createdBy: { id: row.createdBy.id, displayName: row.createdBy.displayName },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function isNameCollision(error: Prisma.PrismaClientKnownRequestError): boolean {
  // Prisma 7 with a MariaDB driver adapter reports the colliding index at
  // meta.driverAdapterError.cause.constraint.index instead of meta.target.
  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: unknown } } } }
    | undefined;
  const index = meta?.driverAdapterError?.cause?.constraint?.index;
  if (typeof index === 'string') {
    return index.includes('_name_key');
  }
  const target = meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === 'string'
      ? [target]
      : [];
  return fields.some((field) => field === 'name') || error.message.includes('_name_key');
}

function translateKnownError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    if (isNameCollision(error)) {
      throw new AppError(
        409,
        'PROJECT_NAME_TAKEN',
        'A project with this name already exists in this workspace',
      );
    }
    throw new AppError(
      409,
      'PROJECT_KEY_TAKEN',
      'A project with this key already exists in this workspace',
    );
  }
  throw error;
}

async function assertProjectManager(
  workspaceId: string,
  actorUserId: string,
): Promise<ActiveMembership> {
  const membership = await getActiveMembership(workspaceId, actorUserId);
  if (!canManageProject(membership.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  return membership;
}

async function getProjectRow(workspaceId: string, projectId: string): Promise<ProjectRow> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: projectSelect,
  });
  if (!project) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
  return project;
}

async function resolveEmptyUpdate(
  workspaceId: string,
  projectId: string,
  conflictCode: 'PROJECT_ARCHIVED' | 'INVALID_LIFECYCLE_TRANSITION',
  message: string,
): Promise<never> {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
  throw new AppError(409, conflictCode, message);
}

export async function createProject(
  workspaceId: string,
  actorUserId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  await assertProjectManager(workspaceId, actorUserId);

  const data: Prisma.ProjectUncheckedCreateInput = {
    workspaceId,
    key: input.key,
    name: input.name,
    description: input.description?.trim() ? input.description.trim() : null,
    visibility: input.visibility,
    status: input.status,
    startDate: input.startDate === undefined ? null : parseDateOnly(input.startDate),
    targetDate: input.targetDate === undefined ? null : parseDateOnly(input.targetDate),
    createdByUserId: actorUserId,
  };

  try {
    const project = await prisma.project.create({ data, select: projectSelect });
    return toProjectDto(project);
  } catch (error) {
    translateKnownError(error);
  }
}

export async function listProjects(
  workspaceId: string,
  actorUserId: string,
  query: ProjectListQueryInput,
): Promise<ProjectListResult> {
  const membership = await getActiveMembership(workspaceId, actorUserId);

  const where: Prisma.ProjectWhereInput = { workspaceId };
  if (query.status !== undefined) where.status = query.status;
  if (query.visibility !== undefined) where.visibility = query.visibility;
  if (query.q !== undefined) {
    where.OR = [{ name: { contains: query.q } }, { key: { contains: query.q } }];
  }
  if (!canManageProject(membership.role)) {
    // Members/guests see workspace-visible projects and private projects they created.
    where.AND = [{ OR: [{ visibility: 'WORKSPACE' }, { createdByUserId: actorUserId }] }];
  }

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: projectSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    items: rows.map(toProjectDto),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function getProject(
  workspaceId: string,
  actorUserId: string,
  projectId: string,
): Promise<ProjectDto> {
  const membership = await getActiveMembership(workspaceId, actorUserId);
  const project = await getProjectRow(workspaceId, projectId);
  if (!canReadProject(membership.role, project, actorUserId)) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }
  return toProjectDto(project);
}

export async function updateProject(
  workspaceId: string,
  actorUserId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDto> {
  await assertProjectManager(workspaceId, actorUserId);
  const current = await getProjectRow(workspaceId, projectId);
  if (current.status === 'ARCHIVED') {
    throw new AppError(409, 'PROJECT_ARCHIVED', 'Archived projects cannot be edited');
  }

  const effectiveStart =
    input.startDate !== undefined ? input.startDate : toDateOnly(current.startDate);
  const effectiveTarget =
    input.targetDate !== undefined ? input.targetDate : toDateOnly(current.targetDate);
  if (effectiveStart !== null && effectiveTarget !== null && effectiveTarget < effectiveStart) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Target date must not precede start date', [
      {
        path: 'targetDate',
        message: 'Target date must not precede start date',
        code: 'custom',
      },
    ]);
  }

  const data: Prisma.ProjectUncheckedUpdateManyInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) {
    const description = input.description?.trim();
    data.description = description && description.length > 0 ? description : null;
  }
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.status !== undefined) data.status = input.status;
  if (input.startDate !== undefined) {
    data.startDate = input.startDate === null ? null : parseDateOnly(input.startDate);
  }
  if (input.targetDate !== undefined) {
    data.targetDate = input.targetDate === null ? null : parseDateOnly(input.targetDate);
  }

  try {
    const result = await prisma.project.updateMany({
      where: { id: projectId, workspaceId, status: { not: 'ARCHIVED' } },
      data,
    });
    if (result.count === 0) {
      await resolveEmptyUpdate(
        workspaceId,
        projectId,
        'PROJECT_ARCHIVED',
        'Archived projects cannot be edited',
      );
    }
  } catch (error) {
    translateKnownError(error);
  }

  return toProjectDto(await getProjectRow(workspaceId, projectId));
}

export async function archiveProject(
  workspaceId: string,
  actorUserId: string,
  projectId: string,
): Promise<ProjectDto> {
  const membership = await getActiveMembership(workspaceId, actorUserId);
  if (!canArchiveProject(membership.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const result = await prisma.project.updateMany({
    where: { id: projectId, workspaceId, status: { not: 'ARCHIVED' } },
    data: { status: 'ARCHIVED', archivedAt: new Date() },
  });
  if (result.count === 0) {
    await resolveEmptyUpdate(
      workspaceId,
      projectId,
      'PROJECT_ARCHIVED',
      'Project is already archived',
    );
  }

  return toProjectDto(await getProjectRow(workspaceId, projectId));
}

export async function restoreProject(
  workspaceId: string,
  actorUserId: string,
  projectId: string,
): Promise<ProjectDto> {
  const membership = await getActiveMembership(workspaceId, actorUserId);
  if (!canRestoreProject(membership.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const result = await prisma.project.updateMany({
    where: { id: projectId, workspaceId, status: 'ARCHIVED' },
    data: { status: 'ACTIVE', archivedAt: null },
  });
  if (result.count === 0) {
    await resolveEmptyUpdate(
      workspaceId,
      projectId,
      'INVALID_LIFECYCLE_TRANSITION',
      'Only archived projects can be restored',
    );
  }

  return toProjectDto(await getProjectRow(workspaceId, projectId));
}
