import type { Request } from 'express';

export function getRequestId(req: Request): string {
  const requestId = (req as Request & { id?: unknown }).id;
  return typeof requestId === 'string' ? requestId : 'unknown';
}
