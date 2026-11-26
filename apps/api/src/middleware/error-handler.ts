import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { getRequestId } from '../lib/request-id.js';
import { logger } from '../lib/logger.js';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

interface BodyParserError {
  type: string;
  status?: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof (error as { type?: unknown }).type === 'string'
  );
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
): void {
  const body: ErrorResponseBody = {
    error: {
      code,
      message,
      requestId,
    },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  res.status(status).json(body);
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  const requestId = getRequestId(req);

  if (error instanceof ZodError) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      requestId,
      error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
        code: issue.code,
      })),
    );
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.status, error.code, error.message, requestId, error.details);
    return;
  }

  if (isBodyParserError(error)) {
    switch (error.type) {
      case 'entity.parse.failed':
        sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON', requestId);
        return;
      case 'entity.too.large':
        sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large', requestId);
        return;
      case 'encoding.unsupported':
        sendError(
          res,
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'The request body encoding is not supported',
          requestId,
        );
        return;
      default:
        sendError(res, 400, 'BAD_REQUEST', 'The request could not be processed', requestId);
        return;
    }
  }

  logger.error({ err: error, requestId }, 'Unhandled request error');
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred', requestId);
}
