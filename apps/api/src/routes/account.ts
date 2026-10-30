import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../errors.js';
import { validateUuidParam } from '../middleware/uuid-param.js';

export const accountRouter = Router();
accountRouter.param('id', validateUuidParam);

accountRouter.get(
  '/users/me/participations',
  requireAuth,
  requireRole('BUYER'),
  async (request, response) => {
    const participations = await prisma.poolParticipation.findMany({
      where: { buyerId: request.user!.id },
      include: {
        pool: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                imageUrl: true,
                seller: { select: { name: true } },
              },
            },
            formFields: { orderBy: { displayOrder: 'asc' } },
            _count: { select: { participations: true } },
          },
        },
        values: { include: { field: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    response.json({ participations });
  },
);

accountRouter.get('/notifications', requireAuth, async (request, response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: request.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  response.json({ notifications });
});

accountRouter.patch(
  '/notifications/:id/read',
  requireAuth,
  async (request, response) => {
    const notificationId = String(request.params.id);
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId: request.user!.id },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw new HttpError(404, 'Notification not found.');
    response.status(204).end();
  },
);

accountRouter.get(
  '/seller/dashboard',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const sellerId = request.user!.id;
    const [products, pools, participants] = await Promise.all([
      prisma.product.count({ where: { sellerId, status: 'ACTIVE' } }),
      prisma.pool.count({ where: { product: { sellerId }, status: 'ACTIVE' } }),
      prisma.poolParticipation.count({
        where: { pool: { product: { sellerId } } },
      }),
    ]);
    const targetReached = await prisma.pool.count({
      where: { product: { sellerId }, status: 'TARGET_REACHED' },
    });
    response.json({
      statistics: { products, activePools: pools, participants, targetReached },
    });
  },
);

accountRouter.get(
  '/admin/users',
  requireAuth,
  requireRole('ADMIN'),
  async (_request, response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    response.json({ users });
  },
);

accountRouter.patch(
  '/admin/users/:id/status',
  requireAuth,
  requireRole('ADMIN'),
  async (request, response) => {
    const userId = String(request.params.id);
    const status = request.body?.status;
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      throw new HttpError(400, 'Status must be ACTIVE or SUSPENDED.');
    }
    if (userId === request.user!.id && status === 'SUSPENDED') {
      throw new HttpError(400, 'You cannot suspend your own account.');
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: request.user!.id,
        action: 'USER_STATUS_CHANGED',
        entityType: 'User',
        entityId: user.id,
        details: { status },
      },
    });
    response.json({ user });
  },
);
