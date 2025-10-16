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

export const TransactionDirectionValues = ['debit', 'credit'] as const;
export const TransactionDirectionSchema = z.enum(TransactionDirectionValues);
export type TransactionDirection = z.infer<typeof TransactionDirectionSchema>;

export const TransactionSourceValues = ['provider', 'manual', 'transfer'] as const;
export const TransactionSourceSchema = z.enum(TransactionSourceValues);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const TransactionStatusValues = ['pending', 'posted'] as const;
export const TransactionStatusSchema = z.enum(TransactionStatusValues);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const NeedsVsWantsValues = ['needs', 'wants', 'neutral'] as const;
export const NeedsVsWantsSchema = z.enum(NeedsVsWantsValues);
export type NeedsVsWants = z.infer<typeof NeedsVsWantsSchema>;

export const TransferStatusValues = [
  'draft',
  'pending_approval',
  'approved',
  'executed',
  'declined',
  'canceled',
] as const;
export const TransferStatusSchema = z.enum(TransferStatusValues);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export const TransferIntentValues = [
  'earn',
  'save',
  'spend',
  'donate',
  'invest',
  'credit_payoff',
  'manual',
] as const;
export const TransferIntentSchema = z.enum(TransferIntentValues);
export type TransferIntent = z.infer<typeof TransferIntentSchema>;

export const IncomeStreamStatusValues = ['active', 'paused', 'archived'] as const;
export const IncomeStreamStatusSchema = z.enum(IncomeStreamStatusValues);
export type IncomeStreamStatus = z.infer<typeof IncomeStreamStatusSchema>;

export const GoalStatusValues = ['active', 'paused', 'achieved', 'archived'] as const;
export const GoalStatusSchema = z.enum(GoalStatusValues);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const OrderSideValues = ['buy', 'sell'] as const;
export const OrderSideSchema = z.enum(OrderSideValues);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderStatusValues = [
  'pending',
  'awaiting_parent',
  'approved',
  'executed',
  'canceled',
  'failed',
] as const;
export const OrderStatusSchema = z.enum(OrderStatusValues);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const LiabilityTypeValues = [
  'secured_credit',
  'loan',
  'student_loan',
  'auto_loan',
  'mortgage',
  'other',
] as const;
export const LiabilityTypeSchema = z.enum(LiabilityTypeValues);
export type LiabilityType = z.infer<typeof LiabilityTypeSchema>;

export const EventKindValues = [
  'account_linked',
  'account_synced',
  'transfer_requested',
  'transfer_approved',
  'transfer_executed',
  'transfer_declined',
  'goal_created',
  'goal_achieved',
  'goal_archived',
  'order_submitted',
  'order_approved',
  'order_executed',
  'order_failed',
  'budget_over_limit',
  'income_request',
  'income_completed',
  'income_skipped',
  'donation_requested',
  'donation_completed',
  'guardrail_updated',
] as const;
export const EventKindSchema = z.enum(EventKindValues);
export type EventKind = z.infer<typeof EventKindSchema>;
