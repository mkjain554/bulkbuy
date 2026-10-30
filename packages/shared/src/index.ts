import { z } from 'zod';

export const roleSchema = z.enum(['BUYER', 'SELLER', 'ADMIN']);
export const fieldTypeSchema = z.enum(['TEXT', 'DROPDOWN', 'DATE']);

export const formFieldSchema = z.discriminatedUnion('type', [
  z.object({
    label: z.string().trim().min(1).max(80),
    type: z.literal('TEXT'),
    required: z.boolean().default(false),
    placeholder: z.string().max(120).optional(),
    helpText: z.string().max(240).optional(),
  }),
  z.object({
    label: z.string().trim().min(1).max(80),
    type: z.literal('DROPDOWN'),
    required: z.boolean().default(false),
    options: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(30)
      .refine((options) => new Set(options).size === options.length, {
        message: 'Dropdown options must be unique.',
      }),
    helpText: z.string().max(240).optional(),
  }),
  z.object({
    label: z.string().trim().min(1).max(80),
    type: z.literal('DATE'),
    required: z.boolean().default(false),
    minDate: z.iso.date().optional(),
    maxDate: z.iso.date().optional(),
    helpText: z.string().max(240).optional(),
  }),
]);

export const formDefinitionSchema = z
  .object({
    fields: z.array(formFieldSchema).max(30),
  })
  .superRefine(({ fields }, context) => {
    fields.forEach((field, index) => {
      if (
        field.type === 'DATE' &&
        field.minDate &&
        field.maxDate &&
        field.minDate > field.maxDate
      ) {
        context.addIssue({
          code: 'custom',
          path: ['fields', index, 'maxDate'],
          message: 'Maximum date must be on or after minimum date.',
        });
      }
    });
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      'Use at least one uppercase letter, one lowercase letter, and one number.',
    ),
  role: z.enum(['BUYER', 'SELLER']),
});

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brand: z.string().trim().min(1).max(80),
  description: z.string().trim().min(10).max(4000),
  categoryId: z.uuid(),
  sku: z.string().trim().max(80).optional(),
  imageUrl: z.url().optional(),
});

const priceSchema = z.union([
  z
    .string()
    .regex(
      /^(?=.*[1-9])\d{1,8}(?:\.\d{1,2})?$/,
      'Enter a positive price with up to two decimals.',
    ),
  z.number().finite().positive().max(99_999_999.99),
]);

export const poolSchema = z
  .object({
    productId: z.uuid(),
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(3000),
    regularPrice: priceSchema,
    groupPrice: priceSchema,
    minBuyers: z.number().int().positive().max(100_000),
    maxParticipants: z.number().int().positive().max(100_000).nullable(),
    startsAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    fields: z.array(formFieldSchema).max(30).default([]),
  })
  .refine((value) => value.closesAt > value.startsAt, {
    message: 'Closing time must be after start time.',
    path: ['closesAt'],
  })
  .refine(
    (value) =>
      value.maxParticipants === null ||
      value.maxParticipants >= value.minBuyers,
    {
      message: 'Maximum participants must be at least the minimum buyers.',
      path: ['maxParticipants'],
    },
  );

export const joinPoolSchema = z.object({
  responses: z.record(z.uuid(), z.union([z.string(), z.null()])),
});

export type FormFieldInput = z.infer<typeof formFieldSchema>;
export type UserRole = z.infer<typeof roleSchema>;
