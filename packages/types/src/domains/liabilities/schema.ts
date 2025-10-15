import { z } from 'zod';
import { CurrencyAmountSchema } from '../../shared/primitives';
import { LiabilityTypeSchema } from '../../shared/enums';

export const LiabilityTermsRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  accountId: z.string(),
  liabilityType: LiabilityTypeSchema,
  originPrincipal: CurrencyAmountSchema,
  interestRate: z.number(),
  minimumPayment: CurrencyAmountSchema,
  statementDay: z.number().nullable(),
  dueDay: z.number().nullable(),
  maturesAt: z.number().nullable(),
  openedAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const UpsertLiabilityTermsInputSchema = z.object({
  organizationId: z.string(),
  accountId: z.string(),
  liabilityType: LiabilityTypeSchema,
  originPrincipal: CurrencyAmountSchema,
  interestRate: z.number(),
  minimumPayment: CurrencyAmountSchema,
  statementDay: z.number().min(1).max(31).nullable().optional(),
  dueDay: z.number().min(1).max(31).nullable().optional(),
  maturesAt: z.number().nullable().optional(),
  openedAt: z.number(),
});

export type LiabilityTermsRecord = z.infer<typeof LiabilityTermsRecordSchema>;
export type UpsertLiabilityTermsInput = z.infer<typeof UpsertLiabilityTermsInputSchema>;
