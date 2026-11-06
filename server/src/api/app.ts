import { timingSafeEqual } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import { ZodError } from 'zod';
import { UserLimitError } from '../users.js';
import { createRouter, type RouterDependencies } from './router.js';

const MAX_BODY_SIZE = '2kb';

export interface AppDependencies extends RouterDependencies {
  appKey?: string;
}

export function createApp({ appKey, ...routerDependencies }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.status(204).end());
  if (appKey) app.use(requireAppKey(appKey));
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(createRouter(routerDependencies));
  app.use(handleErrors);
  return app;
}

function requireAppKey(expectedKey: string): RequestHandler {
  const expected = Buffer.from(expectedKey);
  return (req, res, next) => {
    const provided = Buffer.from(req.get('x-app-key') ?? '');
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) return next();
    res.status(401).json({ error: 'Invalid app key' });
  };
}

const handleErrors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', issues: error.issues });
  } else if (error instanceof UserLimitError) {
    res.status(503).json({ error: error.message });
  } else if (isClientError(error)) {
    res.status(error.status).json({ error: error.message });
  } else {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
};

function isClientError(error: unknown): error is { status: number; message: string } {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}
