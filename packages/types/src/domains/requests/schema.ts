import { z } from 'zod';

export const RequestKindValues = ['money_map_change'] as const;
export const RequestKindSchema = z.enum(RequestKindValues);

export const RequestStateValues = ['pending', 'approved', 'rejected'] as const;
export const RequestStateSchema = z.enum(RequestStateValues);

export const RequestRecordSchema = z.object({
  _id: z.string(),
  householdId: z.string(),
  createdByProfileId: z.string(),
  assignedToProfileId: z.string().nullable().optional(),
  kind: RequestKindSchema,
  state: RequestStateSchema,
  payload: z.record(z.string(), z.any()).optional(),
  resolvedByProfileId: z.string().nullable().optional(),
  resolvedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type RequestRecord = z.infer<typeof RequestRecordSchema>;
export type RequestKind = z.infer<typeof RequestKindSchema>;
export type RequestState = z.infer<typeof RequestStateSchema>;
