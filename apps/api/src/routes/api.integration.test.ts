import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../app.js';
import { prisma } from '../db.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const password = 'E2ePass-2026!';
type TestAgent = ReturnType<typeof supertest.agent> & { csrfToken: string };
const createAgent = (): TestAgent =>
  Object.assign(supertest.agent(app), { csrfToken: '' });

describe.skipIf(!enabled)('marketplace buyer and seller flow', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a seller offer, validates form values, and joins only once', async () => {
    const seller = createAgent();
    const buyer = createAgent();
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const category = await prisma.productCategory.create({
      data: {
        name: `Integration ${sellerId.slice(0, 8)}`,
        slug: `integration-${sellerId}`,
      },
    });

    await register(seller, `seller-${sellerId}@test.local`, 'SELLER');
    await register(buyer, `buyer-${buyerId}@test.local`, 'BUYER');

    const productResponse = await seller
      .post('/api/products')
      .set('X-CSRF-Token', seller.csrfToken)
      .send({
        name: 'Integration phone',
        brand: 'Test brand',
        description:
          'A device listing used to validate the real marketplace API.',
        categoryId: category.id,
      })
      .expect(201);
    const productId = productResponse.body.product.id as string;

    const poolResponse = await seller
      .post('/api/pools')
      .set('X-CSRF-Token', seller.csrfToken)
      .send({
        productId,
        title: 'Integration pool',
        description: 'A group offer created by an API integration test.',
        regularPrice: 1000,
        groupPrice: 800,
        minBuyers: 2,
        maxParticipants: 2,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        fields: [
          {
            label: 'Color',
            type: 'DROPDOWN',
            required: true,
            options: ['Black', 'Silver'],
          },
        ],
      })
      .expect(201);
    const poolId = poolResponse.body.pool.id as string;
    await seller
      .post(`/api/pools/${poolId}/publish`)
      .set('X-CSRF-Token', seller.csrfToken)
      .expect(200);
    const fieldId = poolResponse.body.pool.formFields[0].id as string;

    await buyer
      .post(`/api/pools/${poolId}/join`)
      .set('X-CSRF-Token', buyer.csrfToken)
      .send({ responses: { [fieldId]: 'Not a valid choice' } })
      .expect(400);

    await buyer
      .post(`/api/pools/${poolId}/join`)
      .set('X-CSRF-Token', buyer.csrfToken)
      .send({ responses: { [randomUUID()]: 'Black' } })
      .expect(400);

    await buyer
      .post(`/api/pools/${poolId}/join`)
      .set('X-CSRF-Token', buyer.csrfToken)
      .send({ responses: { [fieldId]: 'Black' } })
      .expect(201);

    await buyer
      .post(`/api/pools/${poolId}/join`)
      .set('X-CSRF-Token', buyer.csrfToken)
      .send({ responses: { [fieldId]: 'Silver' } })
      .expect(409);

    const privateResponses = await buyer
      .get('/api/users/me/participations')
      .expect(200);
    expect(privateResponses.body.participations).toHaveLength(1);
    expect(privateResponses.body.participations[0].values[0].value).toBe(
      'Black',
    );

    await buyer.get(`/api/pools/${poolId}/participants`).expect(403);
    await seller.get(`/api/pools/${poolId}/participants`).expect(200);
    await seller
      .put(`/api/pools/${poolId}/form`)
      .set('X-CSRF-Token', seller.csrfToken)
      .send({ fields: [] })
      .expect(409);
    await buyer.get('/api/admin/users').expect(403);

    const publicPools = await supertest(app).get('/api/pools').expect(200);
    expect(
      publicPools.body.pools.some((pool: { id: string }) => pool.id === poolId),
    ).toBe(true);
  });

  it('serializes simultaneous joins so the pool target is reached only once', async () => {
    const seller = createAgent();
    const category = await prisma.productCategory.create({
      data: {
        name: `Concurrent ${randomUUID().slice(0, 8)}`,
        slug: `concurrent-${randomUUID()}`,
      },
    });
    await register(seller, `seller-${randomUUID()}@test.local`, 'SELLER');
    const productResponse = await seller
      .post('/api/products')
      .set('X-CSRF-Token', seller.csrfToken)
      .send({
        name: 'Concurrent test item',
        brand: 'Test brand',
        description: 'A product for testing concurrent capacity enforcement.',
        categoryId: category.id,
      })
      .expect(201);
    const poolResponse = await seller
      .post('/api/pools')
      .set('X-CSRF-Token', seller.csrfToken)
      .send({
        productId: productResponse.body.product.id,
        title: 'Two places only',
        description: 'Concurrent requests must not exceed the target capacity.',
        regularPrice: 1000,
        groupPrice: 700,
        minBuyers: 2,
        maxParticipants: 2,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        fields: [],
      })
      .expect(201);
    const poolId = poolResponse.body.pool.id as string;
    await seller
      .post(`/api/pools/${poolId}/publish`)
      .set('X-CSRF-Token', seller.csrfToken)
      .expect(200);
    const buyers = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const buyer = createAgent();
        await register(buyer, `buyer-${randomUUID()}@test.local`, 'BUYER');
        return buyer;
      }),
    );
    const attempts = await Promise.all(
      buyers.map((buyer) =>
        buyer
          .post(`/api/pools/${poolId}/join`)
          .set('X-CSRF-Token', buyer.csrfToken)
          .send({ responses: {} }),
      ),
    );
    expect(attempts.filter((attempt) => attempt.status === 201)).toHaveLength(
      2,
    );
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(
      1,
    );
    const finalPool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { _count: { select: { participations: true } } },
    });
    expect(finalPool?._count.participations).toBe(2);
    expect(finalPool?.status).toBe('TARGET_REACHED');
  });
});

async function register(
  agent: TestAgent,
  email: string,
  role: 'BUYER' | 'SELLER',
) {
  const csrfResponse = await agent.get('/api/auth/csrf').expect(200);
  agent.csrfToken = csrfResponse.body.csrfToken as string;
  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', agent.csrfToken)
    .send({ name: 'Integration User', email, password, role })
    .expect(201);
}
