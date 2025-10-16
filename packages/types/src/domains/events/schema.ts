import { z } from 'zod';
import { EventKindSchema } from '../../shared/enums';

export const EventEntityReferenceSchema = z.object({
  table: z.string(),
  id: z.string(),
});

export const EventJournalRecordSchema = z.object({
  _id: z.string(),
  organizationId: z.string(),
  eventKind: EventKindSchema,
  actorProfileId: z.string().nullable().optional(),
  primaryEntity: EventEntityReferenceSchema,
  relatedEntities: z.array(EventEntityReferenceSchema).optional(),
  payload: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
});

export const EventReceiptRecordSchema = z.object({
  _id: z.string(),
  eventId: z.string(),
  profileId: z.string(),
  deliveredAt: z.number(),
  readAt: z.number().nullable().optional(),
});

export const EventReceiptViewSchema = z.object({
  eventId: z.string(),
  deliveredAt: z.number().nullable(),
  readAt: z.number().nullable(),
});

export const EventJournalWithReceiptSchema = EventJournalRecordSchema.extend({
  receipt: EventReceiptViewSchema.nullable().optional(),
});

export const NotificationChannelValues = ['in_app', 'email', 'sms'] as const;
export const NotificationChannelSchema = z.enum(NotificationChannelValues);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationPreferenceRecordSchema = z.object({
  _id: z.string(),
  profileId: z.string(),
  channel: NotificationChannelSchema,
  eventKind: EventKindSchema,
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type EventEntityReference = z.infer<typeof EventEntityReferenceSchema>;
export type EventJournalRecord = z.infer<typeof EventJournalRecordSchema>;
export type EventReceiptRecord = z.infer<typeof EventReceiptRecordSchema>;
export type EventReceiptView = z.infer<typeof EventReceiptViewSchema>;
export type EventJournalWithReceipt = z.infer<typeof EventJournalWithReceiptSchema>;
export type NotificationPreferenceRecord = z.infer<
  typeof NotificationPreferenceRecordSchema
>;
