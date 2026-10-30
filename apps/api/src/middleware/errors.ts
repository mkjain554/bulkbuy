import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../errors.js';
import { isProduction } from '../config.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Request validation failed.',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      response
        .status(409)
        .json({ error: 'A record with that value already exists.' });
      return;
    }
    if (error.code === 'P2025') {
      response
        .status(404)
        .json({ error: 'The requested record was not found.' });
      return;
    }
  }
  response.status(500).json({
    error: 'An unexpected server error occurred.',
    ...(!isProduction && error instanceof Error
      ? { detail: error.message }
      : {}),
  });
};
