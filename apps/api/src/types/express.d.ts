import type { ValidatedData } from '../middleware/validate.js';

declare global {
  namespace Express {
    interface Request {
      validated?: ValidatedData;
      auth?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}

export {};
