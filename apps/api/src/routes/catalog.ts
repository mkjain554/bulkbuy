import { Router } from 'express';
import { productSchema } from '@bulkbuy/shared';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { validateUuidParam } from '../middleware/uuid-param.js';

export const catalogRouter = Router();
catalogRouter.param('id', validateUuidParam);

catalogRouter.get('/categories', async (_request, response) => {
  const categories = await prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
  response.json({ categories });
});

catalogRouter.get('/products', async (request, response) => {
  const search = String(request.query.search ?? '')
    .trim()
    .slice(0, 100);
  const categoryId =
    typeof request.query.categoryId === 'string'
      ? request.query.categoryId
      : undefined;
  const page = Math.max(1, Number(request.query.page) || 1);
  const pageSize = Math.min(
    40,
    Math.max(1, Number(request.query.pageSize) || 12),
  );
  const where = {
    status: 'ACTIVE' as const,
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { brand: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { id: true, name: true } },
        pools: {
          where: { status: { in: ['ACTIVE', 'SCHEDULED', 'TARGET_REACHED'] } },
          include: { _count: { select: { participations: true } } },
          orderBy: { closesAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  response.json({
    products,
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
  });
});

catalogRouter.get(
  '/products/mine',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const products = await prisma.product.findMany({
      where: { sellerId: request.user!.id, status: 'ACTIVE' },
      include: { category: true, _count: { select: { pools: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    response.json({ products });
  },
);

catalogRouter.get('/products/:id', async (request, response) => {
  const product = await prisma.product.findFirst({
    where: { id: String(request.params.id), status: 'ACTIVE' },
    include: {
      category: true,
      seller: { select: { id: true, name: true } },
      pools: {
        where: { status: { in: ['ACTIVE', 'SCHEDULED', 'TARGET_REACHED'] } },
        include: { _count: { select: { participations: true } } },
        orderBy: { closesAt: 'asc' },
      },
    },
  });
  if (!product) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }
  response.json({ product });
});

catalogRouter.post(
  '/products',
  requireAuth,
  requireRole('SELLER'),
  validateBody(productSchema),
  async (request, response) => {
    const data = request.body;
    const product = await prisma.product.create({
      data: {
        sellerId: request.user!.id,
        categoryId: data.categoryId,
        name: data.name,
        brand: data.brand,
        description: data.description,
        ...(data.sku ? { sku: data.sku } : {}),
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      },
      include: { category: true },
    });
    response.status(201).json({ product });
  },
);

catalogRouter.patch(
  '/products/:id',
  requireAuth,
  requireRole('SELLER'),
  validateBody(productSchema),
  async (request, response) => {
    const productId = String(request.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true },
    });
    if (!product) {
      response.status(404).json({ error: 'Product not found.' });
      return;
    }
    if (product.sellerId !== request.user!.id) {
      response.status(403).json({ error: 'You do not own this product.' });
      return;
    }
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: request.body,
    });
    response.json({ product: updated });
  },
);

catalogRouter.delete(
  '/products/:id',
  requireAuth,
  requireRole('SELLER'),
  async (request, response) => {
    const productId = String(request.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true },
    });
    if (!product) {
      response.status(404).json({ error: 'Product not found.' });
      return;
    }
    if (product.sellerId !== request.user!.id) {
      response.status(403).json({ error: 'You do not own this product.' });
      return;
    }
    const livePools = await prisma.pool.count({
      where: {
        productId: product.id,
        status: { in: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'TARGET_REACHED'] },
      },
    });
    if (livePools > 0) {
      response.status(409).json({
        error: 'Cancel or close this product’s pools before archiving it.',
      });
      return;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'ARCHIVED' },
    });
    response.status(204).end();
  },
);
