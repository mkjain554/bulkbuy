import { FormFieldType, PoolStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import {
  formDefinitionSchema,
  poolSchema,
  joinPoolSchema,
  type FormFieldInput,
} from '@bulkbuy/shared';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { validateUuidParam } from '../middleware/uuid-param.js';

export const poolsRouter = Router();
poolsRouter.param('id', validateUuidParam);

const poolInclude = {
  product: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
      seller: { select: { id: true, name: true } },
    },
  },
  formFields: { orderBy: { displayOrder: 'asc' as const } },
  _count: { select: { participations: true } },
};

async function refreshLifecycle(poolId: string): Promise<void> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      status: true,
      startsAt: true,
      closesAt: true,
      minBuyers: true,
      _count: { select: { participations: true } },
    },
  });
  if (!pool) return;
  let next: PoolStatus | undefined;
  const now = new Date();
  if (pool.status === 'SCHEDULED' && pool.startsAt <= now) next = 'ACTIVE';
  if (
    (pool.status === 'SCHEDULED' || pool.status === 'ACTIVE') &&
    pool.closesAt <= now
  ) {
    next =
      pool._count.participations >= pool.minBuyers
        ? 'TARGET_REACHED'
        : 'FAILED';
  } else if (
    pool.status === 'ACTIVE' &&
    pool._count.participations >= pool.minBuyers
  ) {
    next = 'TARGET_REACHED';
  }
  if (next) {
    await prisma.pool.updateMany({
      where: { id: poolId, status: pool.status },
      data: { status: next },
    });
  }
}

poolsRouter.get('/', async (request, response) => {
  const status =
    typeof request.query.status === 'string' ? request.query.status : undefined;
  if (status && !Object.values(PoolStatus).includes(status as PoolStatus)) {
    throw new HttpError(400, 'Unknown pool status.');
  }
  const search = String(request.query.search ?? '')
    .trim()
    .slice(0, 100);
  const page = Math.max(1, Number(request.query.page) || 1);
  const pageSize = Math.min(
    40,
    Math.max(1, Number(request.query.pageSize) || 12),
  );
  const where: Prisma.PoolWhereInput = {
    status: status
      ? (status as PoolStatus)
      : { in: ['ACTIVE', 'SCHEDULED', 'TARGET_REACHED'] },
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const rows = await prisma.pool.findMany({
    where,
    select: { id: true },
  });
  await Promise.all(rows.map(({ id }) => refreshLifecycle(id)));
  const [pools, total] = await prisma.$transaction([
    prisma.pool.findMany({
      where: {
        ...where,
        status: status
          ? (status as PoolStatus)
          : { in: ['ACTIVE', 'SCHEDULED', 'TARGET_REACHED'] },
      },
      include: poolInclude,
      orderBy: [{ closesAt: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pool.count({ where }),
  ]);
  response.json({
    pools,
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
  });
});

poolsRouter.get(
  '/mine',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const pools = await prisma.pool.findMany({
      where: { product: { sellerId: request.user!.id } },
      include: poolInclude,
      orderBy: { createdAt: 'desc' },
    });
    response.json({ pools });
  },
);

poolsRouter.get('/:id', async (request, response) => {
  const poolId = String(request.params.id);
  await refreshLifecycle(poolId);
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: poolInclude,
  });
  if (!pool || pool.status === 'DRAFT' || pool.status === 'CANCELLED') {
    response.status(404).json({ error: 'Pool not found.' });
    return;
  }
  response.json({ pool });
});

poolsRouter.post(
  '/',
  requireAuth,
  requireRole('SELLER'),
  validateBody(poolSchema),
  async (request, response) => {
    const data = poolSchema.parse(request.body);
    const product = await prisma.product.findFirst({
      where: {
        id: data.productId,
        sellerId: request.user!.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!product)
      throw new HttpError(404, 'Select one of your active products.');
    if (new Date(data.closesAt) <= new Date()) {
      throw new HttpError(400, 'Pool closing time must be in the future.');
    }
    const regularPrice = new Prisma.Decimal(String(data.regularPrice));
    const groupPrice = new Prisma.Decimal(String(data.groupPrice));
    if (groupPrice.greaterThanOrEqualTo(regularPrice)) {
      throw new HttpError(400, 'Group price must be lower than regular price.');
    }
    const fields = data.fields.map(
      (field: FormFieldInput, displayOrder: number) => {
        const { type, label, required, ...config } = field;
        return {
          label,
          type: type as FormFieldType,
          required,
          config: config as Prisma.InputJsonValue,
          displayOrder,
        };
      },
    );
    const pool = await prisma.pool.create({
      data: {
        productId: product.id,
        title: data.title,
        description: data.description,
        regularPrice,
        groupPrice,
        minBuyers: data.minBuyers,
        maxParticipants: data.maxParticipants,
        startsAt: new Date(data.startsAt),
        closesAt: new Date(data.closesAt),
        status: 'DRAFT',
        formFields: { create: fields },
      },
      include: poolInclude,
    });
    response.status(201).json({ pool });
  },
);

poolsRouter.put(
  '/:id/form',
  requireAuth,
  requireRole('SELLER'),
  validateBody(formDefinitionSchema),
  async (request, response) => {
    const poolId = String(request.params.id);
    const { fields } = formDefinitionSchema.parse(request.body);
    const preparedFields = fields.map(
      (field: FormFieldInput, displayOrder: number) => {
        const { type, label, required, ...config } = field;
        return {
          poolId,
          label,
          type: type as FormFieldType,
          required,
          config: config as Prisma.InputJsonValue,
          displayOrder,
        };
      },
    );
    const updatedFields = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id" FROM "Pool" WHERE "id" = ${poolId}::uuid FOR UPDATE
      `;
      const current = await transaction.pool.findFirst({
        where: { id: poolId, product: { sellerId: request.user!.id } },
        include: { _count: { select: { participations: true } } },
      });
      if (!current) throw new HttpError(404, 'Pool not found.');
      if (current._count.participations > 0) {
        throw new HttpError(
          409,
          'Form fields are locked after the first buyer joins.',
        );
      }
      if (['SUCCESSFUL', 'FAILED', 'CANCELLED'].includes(current.status)) {
        throw new HttpError(409, 'This pool is no longer editable.');
      }
      await transaction.poolFormField.deleteMany({ where: { poolId } });
      if (preparedFields.length > 0) {
        await transaction.poolFormField.createMany({ data: preparedFields });
      }
      return transaction.poolFormField.findMany({
        where: { poolId },
        orderBy: { displayOrder: 'asc' },
      });
    });
    response.json({ fields: updatedFields });
  },
);

poolsRouter.post(
  '/:id/publish',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const poolId = String(request.params.id);
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, product: { sellerId: request.user!.id } },
      include: { product: { select: { status: true } } },
    });
    if (!pool) throw new HttpError(404, 'Pool not found.');
    if (pool.status !== 'DRAFT') {
      throw new HttpError(409, 'Only draft pools can be published.');
    }
    if (pool.product.status !== 'ACTIVE') {
      throw new HttpError(
        409,
        'Archive status prevents publishing this product.',
      );
    }
    if (pool.closesAt <= new Date()) {
      throw new HttpError(400, 'Pool closing time must be in the future.');
    }
    const updated = await prisma.pool.updateMany({
      where: { id: poolId, status: 'DRAFT' },
      data: {
        status: pool.startsAt > new Date() ? 'SCHEDULED' : 'ACTIVE',
      },
    });
    if (updated.count !== 1) {
      throw new HttpError(
        409,
        'The pool changed before it could be published.',
      );
    }
    const published = await prisma.pool.findUnique({
      where: { id: poolId },
      include: poolInclude,
    });
    response.status(200).json({ pool: published });
  },
);

poolsRouter.post(
  '/:id/join',
  requireAuth,
  requireRole('BUYER'),
  validateBody(joinPoolSchema),
  async (request, response) => {
    const { responses } = joinPoolSchema.parse(request.body);
    const poolId = String(request.params.id);
    const buyerId = request.user!.id;

    const participation = await prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Pool" WHERE "id" = ${poolId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) throw new HttpError(404, 'Pool not found.');
      const pool = await transaction.pool.findUnique({
        where: { id: poolId },
        include: {
          product: { select: { sellerId: true } },
          formFields: { orderBy: { displayOrder: 'asc' } },
          _count: { select: { participations: true } },
        },
      });
      if (!pool) throw new HttpError(404, 'Pool not found.');
      const now = new Date();
      let currentStatus = pool.status;
      if (pool.closesAt <= now) {
        currentStatus =
          pool._count.participations >= pool.minBuyers
            ? 'TARGET_REACHED'
            : 'FAILED';
        await transaction.pool.update({
          where: { id: pool.id },
          data: { status: currentStatus },
        });
      } else if (pool.startsAt > now) {
        currentStatus = 'SCHEDULED';
      } else if (currentStatus === 'SCHEDULED') {
        currentStatus = 'ACTIVE';
        await transaction.pool.update({
          where: { id: pool.id },
          data: { status: currentStatus },
        });
      }
      if (currentStatus !== 'ACTIVE') {
        throw new HttpError(
          409,
          'This pool is not currently accepting participants.',
        );
      }
      if (
        pool.maxParticipants !== null &&
        pool._count.participations >= pool.maxParticipants
      ) {
        throw new HttpError(
          409,
          'This pool has reached its participant limit.',
        );
      }
      const allowedFieldIds = new Set(pool.formFields.map((field) => field.id));
      for (const fieldId of Object.keys(responses)) {
        if (!allowedFieldIds.has(fieldId)) {
          throw new HttpError(
            400,
            'A response refers to an unknown form field.',
          );
        }
      }
      for (const field of pool.formFields) {
        const value = responses[field.id];
        if (
          (value === undefined || value === null || value.trim() === '') &&
          field.required
        ) {
          throw new HttpError(400, `${field.label} is required.`);
        }
        if (value === undefined || value === null || value.trim() === '')
          continue;
        if (field.type === 'DROPDOWN') {
          const options = (field.config as { options?: unknown }).options;
          if (!Array.isArray(options) || !options.includes(value)) {
            throw new HttpError(
              400,
              `Choose a valid option for ${field.label}.`,
            );
          }
        }
        if (field.type === 'DATE') {
          const dateConfig = field.config as {
            minDate?: string;
            maxDate?: string;
          };
          const parsedDate = new Date(`${value}T00:00:00.000Z`);
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== value
          ) {
            throw new HttpError(400, `Enter a valid date for ${field.label}.`);
          }
          if (dateConfig.minDate && value < dateConfig.minDate) {
            throw new HttpError(
              400,
              `${field.label} is earlier than the allowed date.`,
            );
          }
          if (dateConfig.maxDate && value > dateConfig.maxDate) {
            throw new HttpError(
              400,
              `${field.label} is later than the allowed date.`,
            );
          }
        }
        if (field.type === 'TEXT' && value.length > 2000) {
          throw new HttpError(
            400,
            `${field.label} must be 2000 characters or fewer.`,
          );
        }
      }
      const created = await transaction.poolParticipation.create({
        data: {
          poolId: pool.id,
          buyerId,
          values: {
            create: pool.formFields
              .filter(
                (field) =>
                  responses[field.id] !== undefined &&
                  responses[field.id] !== null,
              )
              .map((field) => ({
                fieldId: field.id,
                value: responses[field.id] as string,
              })),
          },
        },
        select: { id: true, createdAt: true },
      });
      const participantCount = pool._count.participations + 1;
      await transaction.notification.create({
        data: {
          userId: buyerId,
          type: 'POOL_JOINED',
          message: `You joined "${pool.title}". No payment was collected.`,
        },
      });
      if (participantCount >= pool.minBuyers) {
        await transaction.pool.update({
          where: { id: pool.id },
          data: { status: 'TARGET_REACHED' },
        });
        await transaction.notification.upsert({
          where: { dedupeKey: `pool-target:${pool.id}` },
          create: {
            userId: pool.product.sellerId,
            type: 'POOL_TARGET_REACHED',
            message: `Your pool "${pool.title}" reached its buyer target. Confirm the next step with participants.`,
            dedupeKey: `pool-target:${pool.id}`,
          },
          update: {},
        });
      }
      return { ...created, participantCount };
    });
    response.status(201).json({ participation });
  },
);

poolsRouter.get(
  '/:id/participants',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const poolId = String(request.params.id);
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, product: { sellerId: request.user!.id } },
      select: { id: true },
    });
    if (!pool) throw new HttpError(404, 'Pool not found.');
    const participants = await prisma.poolParticipation.findMany({
      where: { poolId: pool.id },
      include: {
        buyer: { select: { id: true, name: true } },
        values: {
          include: { field: { select: { id: true, label: true, type: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    response.json({ participants });
  },
);

poolsRouter.post(
  '/:id/close',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const poolId = String(request.params.id);
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, product: { sellerId: request.user!.id } },
      include: { _count: { select: { participations: true } } },
    });
    if (!pool) throw new HttpError(404, 'Pool not found.');
    if (!['TARGET_REACHED', 'FAILED'].includes(pool.status)) {
      throw new HttpError(
        409,
        'Only target-reached or failed pools can be closed.',
      );
    }
    const updated = await prisma.pool.update({
      where: { id: pool.id },
      data: {
        status: pool.status === 'TARGET_REACHED' ? 'SUCCESSFUL' : 'FAILED',
      },
    });
    response.json({ pool: updated });
  },
);

poolsRouter.post(
  '/:id/cancel',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const poolId = String(request.params.id);
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, product: { sellerId: request.user!.id } },
      include: { _count: { select: { participations: true } } },
    });
    if (!pool) throw new HttpError(404, 'Pool not found.');
    if (pool._count.participations > 0) {
      throw new HttpError(409, 'A pool with participants cannot be cancelled.');
    }
    if (!['DRAFT', 'SCHEDULED', 'ACTIVE'].includes(pool.status)) {
      throw new HttpError(409, 'This pool can no longer be cancelled.');
    }
    const updated = await prisma.pool.update({
      where: { id: pool.id },
      data: { status: 'CANCELLED' },
    });
    response.json({ pool: updated });
  },
);

poolsRouter.get(
  '/:id/my-participation',
  requireAuth,
  requireRole('BUYER'),
  async (request, response) => {
    const poolId = String(request.params.id);
    const participation = await prisma.poolParticipation.findUnique({
      where: { poolId_buyerId: { poolId, buyerId: request.user!.id } },
      include: { values: { include: { field: true } } },
    });
    response.json({ participation });
  },
);
