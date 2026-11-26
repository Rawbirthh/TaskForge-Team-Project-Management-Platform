import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';

export interface ValidatedData {
  params?: unknown;
  query?: unknown;
  body?: unknown;
}

export interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

/**
 * Parses the requested request parts with Zod and exposes only the parsed values
 * on `req.validated`. Raw request values are never trusted downstream.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const validated: ValidatedData = {};

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        next(result.error);
        return;
      }
      validated.params = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        next(result.error);
        return;
      }
      validated.query = result.data;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        next(result.error);
        return;
      }
      validated.body = result.data;
    }

    req.validated = validated;
    next();
  };
}

export function getValidated<T>(req: Request, key: keyof ValidatedData): T {
  const value = req.validated?.[key];
  if (value === undefined) {
    throw new Error(`Request ${key} was not validated`);
  }
  return value as T;
}
