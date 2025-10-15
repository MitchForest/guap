import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import {
  InvestmentPositionRecordSchema,
  InvestmentOrderRecordSchema,
  WatchlistEntryRecordSchema,
  InstrumentSnapshotRecordSchema,
  InvestmentGuardrailEvaluationSchema,
  OrderStatusSchema,
  CreateInvestmentOrderInputSchema,
  ApproveInvestmentOrderInputSchema,
  CancelInvestmentOrderInputSchema,
} from '@guap/types';

const ListPositionsQuery = 'domains/investing/queries:listPositions' as const;
const ListOrdersQuery = 'domains/investing/queries:listOrders' as const;
const GetOrderQuery = 'domains/investing/queries:getOrderById' as const;
const ListWatchlistQuery = 'domains/investing/queries:listWatchlistEntries' as const;
const GetGuardrailQuery = 'domains/investing/queries:getGuardrailSummary' as const;
const ListSnapshotsQuery = 'domains/investing/queries:listInstrumentSnapshots' as const;

const SubmitOrderMutation = 'domains/investing/mutations:submitOrder' as const;
const ApproveOrderMutation = 'domains/investing/mutations:approveOrder' as const;
const CancelOrderMutation = 'domains/investing/mutations:cancelOrder' as const;
const UpsertWatchlistMutation = 'domains/investing/mutations:upsertWatchlistEntry' as const;
const RemoveWatchlistMutation = 'domains/investing/mutations:removeWatchlistEntry' as const;

const ListPositionsInputSchema = z.object({
  organizationId: z.string(),
});

const ListOrdersInputSchema = z.object({
  organizationId: z.string(),
  status: z.array(OrderStatusSchema).optional(),
  limit: z.number().optional(),
});

const ListWatchlistInputSchema = z.object({
  organizationId: z.string(),
  profileId: z.string().optional(),
});

const UpsertWatchlistInputSchema = z.object({
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
  instrumentType: z.string(),
  notes: z.string().optional(),
});

const RemoveWatchlistInputSchema = z.object({
  organizationId: z.string(),
  profileId: z.string(),
  symbol: z.string(),
});

const GuardrailInputSchema = z.object({
  organizationId: z.string(),
  accountId: z.string(),
  symbol: z.string().optional(),
  instrumentType: z.string().optional(),
  side: z.enum(['buy', 'sell']).optional(),
  notionalCents: z.number().optional(),
});

const ListSnapshotsInputSchema = z.object({
  symbol: z.string(),
  limit: z.number().optional(),
});

export class InvestingApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async listPositions(input: z.input<typeof ListPositionsInputSchema>) {
    const payload = ListPositionsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListPositionsQuery, payload);
    return z.array(InvestmentPositionRecordSchema).parse(result);
  }

  async listOrders(input: z.input<typeof ListOrdersInputSchema>) {
    const payload = ListOrdersInputSchema.parse(input);
    const result = await (this.client.query as any)(ListOrdersQuery, payload);
    return z.array(InvestmentOrderRecordSchema).parse(result);
  }

  async getOrder(input: { organizationId: string; orderId: string }) {
    const result = await (this.client.query as any)(GetOrderQuery, input);
    if (!result) return null;
    return InvestmentOrderRecordSchema.parse(result);
  }

  async submitOrder(input: z.input<typeof CreateInvestmentOrderInputSchema>) {
    const payload = CreateInvestmentOrderInputSchema.parse(input);
    const result = await (this.client.mutation as any)(SubmitOrderMutation, payload);
    return InvestmentOrderRecordSchema.parse(result);
  }

  async approveOrder(input: z.input<typeof ApproveInvestmentOrderInputSchema>) {
    const payload = ApproveInvestmentOrderInputSchema.parse(input);
    const result = await (this.client.mutation as any)(ApproveOrderMutation, payload);
    return InvestmentOrderRecordSchema.parse(result);
  }

  async cancelOrder(input: z.input<typeof CancelInvestmentOrderInputSchema>) {
    const payload = CancelInvestmentOrderInputSchema.parse(input);
    const result = await (this.client.mutation as any)(CancelOrderMutation, payload);
    return InvestmentOrderRecordSchema.parse(result);
  }

  async listWatchlist(input: z.input<typeof ListWatchlistInputSchema>) {
    const payload = ListWatchlistInputSchema.parse(input);
    const result = await (this.client.query as any)(ListWatchlistQuery, payload);
    return z.array(WatchlistEntryRecordSchema).parse(result);
  }

  async upsertWatchlist(input: z.input<typeof UpsertWatchlistInputSchema>) {
    const payload = UpsertWatchlistInputSchema.parse(input);
    const result = await (this.client.mutation as any)(UpsertWatchlistMutation, payload);
    return WatchlistEntryRecordSchema.parse(result);
  }

  async removeWatchlist(input: z.input<typeof RemoveWatchlistInputSchema>) {
    const payload = RemoveWatchlistInputSchema.parse(input);
    await (this.client.mutation as any)(RemoveWatchlistMutation, payload);
  }

  async getGuardrail(input: z.input<typeof GuardrailInputSchema>) {
    const payload = GuardrailInputSchema.parse(input);
    const result = await (this.client.query as any)(GetGuardrailQuery, payload);
    return InvestmentGuardrailEvaluationSchema.parse(result);
  }

  async listSnapshots(input: z.input<typeof ListSnapshotsInputSchema>) {
    const payload = ListSnapshotsInputSchema.parse(input);
    const result = await (this.client.query as any)(ListSnapshotsQuery, payload);
    return z.array(InstrumentSnapshotRecordSchema).parse(result);
  }
}

export const createInvestingApi = (client: ConvexClientInstance) =>
  new InvestingApi(client);
