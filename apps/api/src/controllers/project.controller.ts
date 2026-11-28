import type { NextFunction, Request, Response } from 'express';
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  restoreProject,
  updateProject,
} from '../services/project.service.js';
import { validate, getValidated } from '../middleware/validate.js';
import { workspaceIdParamSchema } from '../schemas/workspace.schemas.js';
import {
  createProjectSchema,
  projectIdParamSchema,
  projectListQuerySchema,
  updateProjectSchema,
} from '../schemas/project.schemas.js';
import { AppError } from '../errors/app-error.js';

function requireRequestAuth(req: Request): string {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  return req.auth.userId;
}

export const projectController = {
  create: [
    validate({ params: workspaceIdParamSchema, body: createProjectSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireRequestAuth(req);
        const params = getValidated<ReturnType<typeof workspaceIdParamSchema.parse>>(req, 'params');
        const body = getValidated<ReturnType<typeof createProjectSchema.parse>>(req, 'body');
        const project = await createProject(params.workspaceId, userId, body);
        res.status(201).json({ data: { project } });
      } catch (error) {
        next(error);
      }
    },
  ],

  list: [
    validate({ params: workspaceIdParamSchema, query: projectListQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireRequestAuth(req);
        const params = getValidated<ReturnType<typeof workspaceIdParamSchema.parse>>(req, 'params');
        const query = getValidated<ReturnType<typeof projectListQuerySchema.parse>>(req, 'query');
        const result = await listProjects(params.workspaceId, userId, query);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],

  get: [
    validate({ params: projectIdParamSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireRequestAuth(req);
        const params = getValidated<ReturnType<typeof projectIdParamSchema.parse>>(req, 'params');
        const project = await getProject(params.workspaceId, userId, params.projectId);
        res.status(200).json({ data: { project } });
      } catch (error) {
        next(error);
      }
    },
  ],

  update: [
    validate({ params: projectIdParamSchema, body: updateProjectSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireRequestAuth(req);
        const params = getValidated<ReturnType<typeof projectIdParamSchema.parse>>(req, 'params');
        const body = getValidated<ReturnType<typeof updateProjectSchema.parse>>(req, 'body');
        const project = await updateProject(params.workspaceId, userId, params.projectId, body);
        res.status(200).json({ data: { project } });
      } catch (error) {
        next(error);
      }
    },
  ],

  archive: [
    validate({ params: projectIdParamSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireRequestAuth(req);
        const params = getValidated<ReturnType<typeof projectIdParamSchema.parse>>(req, 'params');
        const project = await archiveProject(params.workspaceId, userId, params.projectId);
        res.status(200).json({ data: { project } });
      } catch (error) {
        next(error);
      }
    },
  ],

  restore: [
    validate({ params: projectIdParamSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireRequestAuth(req);
        const params = getValidated<ReturnType<typeof projectIdParamSchema.parse>>(req, 'params');
        const project = await restoreProject(params.workspaceId, userId, params.projectId);
        res.status(200).json({ data: { project } });
      } catch (error) {
        next(error);
      }
    },
  ],
};
