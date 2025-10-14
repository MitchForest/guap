import type { EventKind } from '@guap/types';

type EventPayload = {
  organizationId: string;
  eventKind: EventKind;
  actorProfileId?: string | null;
  primaryEntity: { table: string; id: string };
  relatedEntities?: Array<{ table: string; id: string }>;
  payload?: Record<string, unknown> | null;
};

export const logEvent = async (db: any, params: EventPayload) => {
  const timestamp = Date.now();
  await db.insert('eventsJournal', {
    organizationId: params.organizationId,
    eventKind: params.eventKind,
    actorProfileId: params.actorProfileId ?? null,
    primaryEntity: params.primaryEntity,
    relatedEntities: params.relatedEntities,
    payload: params.payload ?? null,
    createdAt: timestamp,
  });
};
