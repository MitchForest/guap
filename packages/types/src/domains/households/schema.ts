import { z } from 'zod';
import { UserRoleSchema, UserRoleValues } from '../auth';
import {
  AccountKindSchema,
  AccountStatusSchema,
  BillingIntervalSchema,
  HouseholdPlanSchema,
  HouseholdPlanStatusSchema,
  IncomeCadenceSchema,
} from '../../shared/enums';
import { CurrencyAmountSchema } from '../../shared/primitives';

export const MembershipRoleValues = UserRoleValues;
export const MembershipRoleSchema = UserRoleSchema;

export const MembershipStatusValues = ['active', 'invited', 'pending'] as const;
export const MembershipStatusSchema = z.enum(MembershipStatusValues);

export const HouseholdRecordSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: HouseholdPlanSchema.default('free'),
  planStatus: HouseholdPlanStatusSchema.default('active'),
  planInterval: BillingIntervalSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const MembershipRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  profileId: z.string(),
  role: MembershipRoleSchema,
  status: MembershipStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AccountRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  ownerProfileId: z.string().nullable().optional(),
  name: z.string(),
  kind: AccountKindSchema,
  status: AccountStatusSchema,
  currency: z.string().default('USD'),
  balanceCents: z.number(),
  availableCents: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const IncomeRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  label: z.string(),
  cadence: IncomeCadenceSchema,
  amountCents: z.number(),
  sourceAccountId: z.string().nullable().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type MembershipRole = z.infer<typeof MembershipRoleSchema>;
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;
export type HouseholdRecord = z.infer<typeof HouseholdRecordSchema>;
export type MembershipRecord = z.infer<typeof MembershipRecordSchema>;
export type AccountRecord = z.infer<typeof AccountRecordSchema>;
export type IncomeRecord = z.infer<typeof IncomeRecordSchema>;
