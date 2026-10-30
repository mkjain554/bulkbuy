import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const password = process.env.SEED_DEMO_PASSWORD ?? 'BulkBuy-Local-2026';

async function seed() {
  const [adminPassword, sellerPassword, buyerPassword] = await Promise.all([
    argon2.hash(password, { type: argon2.argon2id }),
    argon2.hash(password, { type: argon2.argon2id }),
    argon2.hash(password, { type: argon2.argon2id }),
  ]);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bulkbuy.local' },
    update: { passwordHash: adminPassword, status: 'ACTIVE', role: 'ADMIN' },
    create: {
      name: 'BulkBuy Admin',
      email: 'admin@bulkbuy.local',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  const sellers = await Promise.all(
    ['seller.one@bulkbuy.local', 'seller.two@bulkbuy.local'].map(
      (email, index) =>
        prisma.user.upsert({
          where: { email },
          update: {
            passwordHash: sellerPassword,
            role: 'SELLER',
            status: 'ACTIVE',
          },
          create: {
            name: `Demo Seller ${index + 1}`,
            email,
            passwordHash: sellerPassword,
            role: 'SELLER',
          },
        }),
    ),
  );
  const buyers = await Promise.all(
    [
      'buyer.one@bulkbuy.local',
      'buyer.two@bulkbuy.local',
      'buyer.three@bulkbuy.local',
    ].map((email, index) =>
      prisma.user.upsert({
        where: { email },
        update: {
          passwordHash: buyerPassword,
          role: 'BUYER',
          status: 'ACTIVE',
        },
        create: {
          name: `Demo Buyer ${index + 1}`,
          email,
          passwordHash: buyerPassword,
          role: 'BUYER',
        },
      }),
    ),
  );

  const categories = await Promise.all(
    [
      ['Electronics', 'electronics'],
      ['Home & Kitchen', 'home-kitchen'],
      ['Fashion', 'fashion'],
      ['Vehicles', 'vehicles'],
      ['Office & Wholesale', 'office-wholesale'],
    ].map(([name, slug]) =>
      prisma.productCategory.upsert({
        where: { slug },
        update: { name },
        create: { name, slug },
      }),
    ),
  );
  const product = await prisma.product.upsert({
    where: { id: '00000000-0000-4000-8000-000000000101' },
    update: {
      name: 'Studio Wireless Headphones',
      brand: 'Auraloop',
      description:
        'Comfortable over-ear wireless headphones with active noise cancellation and a long-lasting battery.',
      sellerId: sellers[0]!.id,
      categoryId: categories[0]!.id,
      imageUrl:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85',
      status: 'ACTIVE',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000101',
      sellerId: sellers[0]!.id,
      categoryId: categories[0]!.id,
      name: 'Studio Wireless Headphones',
      brand: 'Auraloop',
      description:
        'Comfortable over-ear wireless headphones with active noise cancellation and a long-lasting battery.',
      sku: 'AURA-STUDIO-01',
      imageUrl:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85',
    },
  });
  const poolId = '00000000-0000-4000-8000-000000000201';
  const pool = await prisma.pool.upsert({
    where: { id: poolId },
    update: {
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      closesAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: poolId,
      productId: product.id,
      title: 'The Studio Headphone Group Deal',
      description:
        'Bring together at least five buyers to unlock the seller-advertised group price. Final fulfillment terms are confirmed by the seller.',
      regularPrice: '12999.00',
      groupPrice: '8999.00',
      minBuyers: 5,
      maxParticipants: 20,
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      closesAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      formFields: {
        create: [
          {
            id: '00000000-0000-4000-8000-000000000301',
            label: 'Preferred color',
            type: 'DROPDOWN',
            required: true,
            config: { options: ['Graphite', 'Cloud White', 'Midnight Blue'] },
            displayOrder: 0,
          },
          {
            id: '00000000-0000-4000-8000-000000000302',
            label: 'Expected purchase date',
            type: 'DATE',
            required: false,
            config: {},
            displayOrder: 1,
          },
          {
            id: '00000000-0000-4000-8000-000000000303',
            label: 'Anything else for the seller?',
            type: 'TEXT',
            required: false,
            config: { placeholder: 'Optional note' },
            displayOrder: 2,
          },
        ],
      },
    },
  });
  await Promise.all(
    buyers.slice(0, 2).map((buyer, index) =>
      prisma.poolParticipation.upsert({
        where: { poolId_buyerId: { poolId: pool.id, buyerId: buyer.id } },
        update: {},
        create: {
          poolId: pool.id,
          buyerId: buyer.id,
          values: {
            create: [
              {
                fieldId: '00000000-0000-4000-8000-000000000301',
                value: index === 0 ? 'Graphite' : 'Cloud White',
              },
            ],
          },
        },
      }),
    ),
  );
  await prisma.auditLog.upsert({
    where: { id: '00000000-0000-4000-8000-000000000401' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000401',
      actorId: admin.id,
      action: 'DEMO_SEED_CREATED',
      entityType: 'Marketplace',
      details: { poolId: pool.id },
    },
  });
  console.info(
    `Seeded local marketplace. Demo account password: ${password} (override with SEED_DEMO_PASSWORD).`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
