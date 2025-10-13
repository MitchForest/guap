import { z } from 'zod';

export const HouseholdPlanValues = ['free', 'standard'] as const;
export const HouseholdPlanSchema = z.enum(HouseholdPlanValues);
export type HouseholdPlan = z.infer<typeof HouseholdPlanSchema>;

export const HouseholdPlanStatusValues = ['inactive', 'active', 'past_due', 'canceled'] as const;
export const HouseholdPlanStatusSchema = z.enum(HouseholdPlanStatusValues);
export type HouseholdPlanStatus = z.infer<typeof HouseholdPlanStatusSchema>;

export const BillingIntervalValues = ['monthly', 'annual'] as const;
export const BillingIntervalSchema = z.enum(BillingIntervalValues);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

export const AccountKindValues = [
  'checking',
  'hysa',
  'utma',
  'brokerage',
  'credit',
  'donation',
  'liability',
] as const;
export const AccountKindSchema = z.enum(AccountKindValues);
export type AccountKind = z.infer<typeof AccountKindSchema>;

export const AccountStatusValues = ['active', 'inactive', 'pending', 'closed'] as const;
export const AccountStatusSchema = z.enum(AccountStatusValues);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const IncomeCadenceValues = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;
export const IncomeCadenceSchema = z.enum(IncomeCadenceValues);
export type IncomeCadence = z.infer<typeof IncomeCadenceSchema>;

export const OrganizationKindValues = ['family', 'institution'] as const;
export const OrganizationKindSchema = z.enum(OrganizationKindValues);
export type OrganizationKind = z.infer<typeof OrganizationKindSchema>;
