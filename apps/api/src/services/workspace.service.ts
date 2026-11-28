import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  createWorkspaceSchema,
  normalizeSlug,
  type CreateWorkspaceInput,
  type WorkspaceIdParamInput,
  type WorkspaceListQueryInput,
  type SlugAvailabilityQueryInput,
} from '../schemas/workspace.schemas.js';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMembershipSummary {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
  createdAt: Date;
}

export interface WorkspaceListItem {
  workspace: WorkspaceSummary;
  membership: WorkspaceMembershipSummary;
}

export interface WorkspaceListResult {
  items: WorkspaceListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface WorkspaceDetail {
  workspace: WorkspaceSummary;
  membership: Pick<WorkspaceMembershipSummary, 'id' | 'role' | 'status'>;
}

function toWorkspaceSummary(workspace: {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function deriveSlug(name: string): string {
  const derived = normalizeSlug(name);
  if (derived.length >= 3) return derived.slice(0, 48);
  return `workspace-${derived}`.slice(0, 48);
}

export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
): Promise<WorkspaceSummary> {
  const parsed = createWorkspaceSchema.parse(input);
  const name = parsed.name;
  const slug = parsed.slug ?? deriveSlug(name);

  // Ensure derived slug still satisfies format; if not, fall back.
  let finalSlug = slug;
  if (finalSlug.length < 3) {
    finalSlug = `workspace-${finalSlug}`.slice(0, 48);
  }

  try {
    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: { name, slug: finalSlug },
        select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: created.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      return created;
    });

    return toWorkspaceSummary(workspace);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'WORKSPACE_SLUG_TAKEN', 'A workspace with this slug already exists');
    }
    throw error;
  }
}

export async function listWorkspaces(
  userId: string,
  query: WorkspaceListQueryInput,
): Promise<WorkspaceListResult> {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where = { userId, status: 'ACTIVE' as const };

  const [memberships, total] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.workspaceMembership.count({ where }),
  ]);

  const items: WorkspaceListItem[] = memberships.map((membership) => ({
    workspace: toWorkspaceSummary(membership.workspace),
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt,
    },
  }));

  return { items, page, limit, total };
}

export async function getWorkspace(
  userId: string,
  workspaceId: WorkspaceIdParamInput['workspaceId'],
): Promise<WorkspaceDetail> {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, userId, status: 'ACTIVE' },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
      },
    },
  });

  if (!membership) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  return {
    workspace: toWorkspaceSummary(membership.workspace),
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    },
  };
}

export async function checkSlugAvailability(
  slugInput: SlugAvailabilityQueryInput['slug'],
): Promise<{ slug: string; available: boolean }> {
  const slug = normalizeSlug(slugInput);
  // Re-validate format by parsing through schema transform? Use direct regex.
  if (
    slug.length < 3 ||
    slug.length > 48 ||
    !/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(slug) ||
    slug.includes('--')
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid slug');
  }

  const existing = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });

  return { slug, available: !existing };
}
