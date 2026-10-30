import { createHmac } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { config, cookieOptions, isProduction } from '../config.js';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const sessionCookieName = 'bulkbuy_session';
export const csrfCookieName = 'bulkbuy_csrf';

export function hashToken(token: string): string {
  return createHmac('sha256', config.SESSION_SECRET)
    .update(token)
    .digest('hex');
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(sessionCookieName, token, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 14,
    path: '/',
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName, { ...cookieOptions, path: '/' });
}

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = request.cookies?.[sessionCookieName] as string | undefined;
    if (!token) throw new HttpError(401, 'Authentication required.');
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      throw new HttpError(
        401,
        'Your session has expired. Please sign in again.',
      );
    }
    if (session.user.status !== 'ACTIVE') {
      throw new HttpError(403, 'This account has been suspended.');
    }
    request.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.user) {
      next(new HttpError(401, 'Authentication required.'));
      return;
    }
    if (!roles.includes(request.user.role)) {
      next(
        new HttpError(
          403,
          'You do not have permission to perform this action.',
        ),
      );
      return;
    }
    next();
  };
}

export function setCsrfCookie(response: Response, token: string): void {
  response.cookie(csrfCookieName, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    ...(cookieOptions.domain ? { domain: cookieOptions.domain } : {}),
  });
}
