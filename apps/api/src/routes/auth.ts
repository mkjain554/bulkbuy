import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import argon2 from 'argon2';
import { loginSchema, registerSchema } from '@bulkbuy/shared';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import {
  clearSessionCookie,
  hashToken,
  requireAuth,
  setCsrfCookie,
  setSessionCookie,
  sessionCookieName,
} from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateBody } from '../middleware/validate.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

authRouter.get('/csrf', (_request, response) => {
  const token = randomBytes(32).toString('base64url');
  setCsrfCookie(response, token);
  response.json({ csrfToken: token });
});

authRouter.post(
  '/register',
  authLimiter,
  csrfProtection,
  validateBody(registerSchema),
  async (request, response) => {
    const data = registerSchema.parse(request.body);
    const email = data.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
    });
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        role: data.role,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    const token = randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    setSessionCookie(response, token);
    response.status(201).json({ user });
  },
);

authRouter.post(
  '/login',
  authLimiter,
  csrfProtection,
  validateBody(loginSchema),
  async (request, response) => {
    const data = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (!user || !(await argon2.verify(user.passwordHash, data.password))) {
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    if (user.status !== 'ACTIVE') {
      throw new HttpError(403, 'This account has been suspended.');
    }
    const token = randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    setSessionCookie(response, token);
    response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  },
);

authRouter.post('/logout', csrfProtection, async (request, response) => {
  const token = request.cookies?.[sessionCookieName] as string | undefined;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  clearSessionCookie(response);
  response.status(204).end();
});

authRouter.get('/me', requireAuth, (request, response) => {
  response.json({ user: request.user });
});
