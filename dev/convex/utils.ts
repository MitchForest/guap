import { v } from 'convex/values';

export const literalEnum = <const T extends readonly string[]>(values: T) =>
  v.union(...values.map((value) => v.literal(value)));

