import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const projectsRouter = Router({ mergeParams: true });

projectsRouter.post('/', requireAuth, ...projectController.create);
projectsRouter.get('/', requireAuth, ...projectController.list);
projectsRouter.get('/:projectId', requireAuth, ...projectController.get);
projectsRouter.patch('/:projectId', requireAuth, ...projectController.update);
projectsRouter.post('/:projectId/archive', requireAuth, ...projectController.archive);
projectsRouter.post('/:projectId/restore', requireAuth, ...projectController.restore);
