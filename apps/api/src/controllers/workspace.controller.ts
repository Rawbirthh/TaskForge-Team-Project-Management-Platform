import type { NextFunction, Request, Response } from 'express';
import {
  checkSlugAvailability,
  createWorkspace,
  getWorkspace,
  listWorkspaces,
} from '../services/workspace.service.js';
import { validate, getValidated } from '../middleware/validate.js';
import {
  createWorkspaceSchema,
  slugAvailabilityQuerySchema,
  workspaceIdParamSchema,
  workspaceListQuerySchema,
} from '../schemas/workspace.schemas.js';
import { AppError } from '../errors/app-error.js';

export const workspaceController = {
  create: [
    validate({ body: createWorkspaceSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const body = getValidated<ReturnType<typeof createWorkspaceSchema.parse>>(req, 'body');
        const workspace = await createWorkspace(req.auth.userId, body);
        res.status(201).json({ data: { workspace } });
      } catch (error) {
        next(error);
      }
    },
  ],

  list: [
    validate({ query: workspaceListQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const query = getValidated<ReturnType<typeof workspaceListQuerySchema.parse>>(req, 'query');
        const result = await listWorkspaces(req.auth.userId, query);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],

  get: [
    validate({ params: workspaceIdParamSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const params = getValidated<ReturnType<typeof workspaceIdParamSchema.parse>>(req, 'params');
        const result = await getWorkspace(req.auth.userId, params.workspaceId);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],

  slugAvailability: [
    validate({ query: slugAvailabilityQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const query = getValidated<ReturnType<typeof slugAvailabilityQuerySchema.parse>>(
          req,
          'query',
        );
        const result = await checkSlugAvailability(query.slug);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],
};
