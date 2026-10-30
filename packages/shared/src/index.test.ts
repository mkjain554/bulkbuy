import { describe, expect, it } from 'vitest';
import { formDefinitionSchema, poolSchema, registerSchema } from './index.js';

describe('shared validation', () => {
  it('rejects attempts to register an administrator', () => {
    const result = registerSchema.safeParse({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'StrongPass-2026',
      role: 'ADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('requires unique options and ordered date bounds', () => {
    expect(
      formDefinitionSchema.safeParse({
        fields: [
          {
            label: 'Color',
            type: 'DROPDOWN',
            options: ['Black', 'Black'],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      formDefinitionSchema.safeParse({
        fields: [
          {
            label: 'Pickup day',
            type: 'DATE',
            minDate: '2026-10-31',
            maxDate: '2026-10-01',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects pool capacity below the minimum buyer target', () => {
    const result = poolSchema.safeParse({
      productId: '00000000-0000-4000-8000-000000000101',
      title: 'Sample pool',
      description: 'A valid description for this test pool.',
      regularPrice: 20,
      groupPrice: 10,
      minBuyers: 5,
      maxParticipants: 4,
      startsAt: '2026-10-30T12:00:00.000Z',
      closesAt: '2026-10-31T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
