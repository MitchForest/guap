import type { Id } from '@guap/api/codegen/dataModel';
export {
  ALL_ROLES,
  OWNER_ADMIN_ROLES,
  ensureOrganizationAccess,
  ensureRole,
  requireSession,
  type SessionSnapshot,
} from '../../core/session';

export const now = () => Date.now();

export const scrubMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

export const loadSnapshot = async (db: any, mapId: Id<'moneyMaps'>) => {
  const map = await db.get(mapId);
  if (!map) {
    throw new Error('Money map not found');
  }

  const [nodes, edges, rules] = await Promise.all([
    db
      .query('moneyMapNodes')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect(),
    db
      .query('moneyMapEdges')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect(),
    db
      .query('moneyMapRules')
      .withIndex('by_map', (q: any) => q.eq('mapId', mapId))
      .collect(),
  ]);

  return { map, nodes, edges, rules };
};
