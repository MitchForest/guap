import { describe, expect, it } from 'vitest';
import { scrubMetadata } from '../domains/moneyMaps/services';

describe('money map utilities', () => {
  it('removes nullish metadata entries', () => {
    const result = scrubMetadata({
      id: 'node-1',
      category: null,
      balanceCents: 1200,
      accent: undefined,
    });
    expect(result).toEqual({ id: 'node-1', balanceCents: 1200 });
  });

  it('returns undefined when metadata is empty', () => {
    expect(scrubMetadata({ category: null, accent: undefined })).toBeUndefined();
  });
});
