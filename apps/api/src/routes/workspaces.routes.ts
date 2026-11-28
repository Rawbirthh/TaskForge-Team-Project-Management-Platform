import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const workspacesRouter = Router();

workspacesRouter.post('/', requireAuth, ...workspaceController.create);
workspacesRouter.get('/', requireAuth, ...workspaceController.list);
workspacesRouter.get('/slug-availability', requireAuth, ...workspaceController.slugAvailability);
workspacesRouter.get('/:workspaceId', requireAuth, ...workspaceController.get);
