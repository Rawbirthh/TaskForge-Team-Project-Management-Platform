import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/error-handler.js';
import { getValidated, validate } from '../src/middleware/validate.js';

const echoSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().positive(),
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/echo', validate({ body: echoSchema }), (req, res) => {
    res.json({ data: getValidated<z.infer<typeof echoSchema>>(req, 'body') });
  });
  app.use(errorHandler);
  return app;
}

describe('Zod validation middleware', () => {
  it('passes parsed and coerced values downstream', async () => {
    const response = await request(createTestApp()).post('/echo').send({ name: 'Ada', age: '37' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { name: 'Ada', age: 37 } });
  });

  it('returns field-specific validation errors', async () => {
    const response = await request(createTestApp()).post('/echo').send({ name: '', age: -2 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'age' }),
      ]),
    );
  });

  it('does not trust unvalidated request data', async () => {
    const app = express();
    app.get('/unvalidated', (req, res) => {
      res.json({ data: getValidated(req, 'body') });
    });
    app.use(errorHandler);

    const response = await request(app).get('/unvalidated');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
