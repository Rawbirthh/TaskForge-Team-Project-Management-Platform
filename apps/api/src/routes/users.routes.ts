import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.get('/me/profile', requireAuth, ...profileController.getProfile);
usersRouter.patch('/me/profile', requireAuth, ...profileController.updateProfile);
usersRouter.post('/me/email-change', requireAuth, ...profileController.requestEmailChange);
usersRouter.post('/me/email-change/verify', requireAuth, ...profileController.verifyEmailChange);
usersRouter.post('/me/password', requireAuth, ...profileController.changePassword);
usersRouter.get('/me/sessions', requireAuth, ...profileController.listSessions);
usersRouter.delete('/me/sessions/:sessionId', requireAuth, ...profileController.revokeSession);
usersRouter.post('/me/deactivate', requireAuth, ...profileController.deactivate);
usersRouter.post('/me/delete-request', requireAuth, ...profileController.deleteRequest);
