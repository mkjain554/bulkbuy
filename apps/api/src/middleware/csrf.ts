import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { csrfCookieName } from './auth.js';
import { HttpError } from '../errors.js';

export function csrfProtection(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    next();
    return;
  }
  const cookie = request.cookies?.[csrfCookieName] as string | undefined;
  const header = request.get('x-csrf-token');
  if (
    !cookie ||
    !header ||
    cookie.length !== header.length ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
  ) {
    next(new HttpError(403, 'CSRF token is missing or invalid.'));
    return;
  }
  next();
}
