import { describe, expect, it } from 'vitest';
import { buildCsvContent } from './csv';

describe('buildCsvContent', () => {
  it('serialises rows to CSV format', () => {
    const csv = buildCsvContent({
      columns: [
        { label: 'Name', value: (row: { name: string; note: string }) => row.name },
        { label: 'Note', value: (row) => row.note },
      ],
      rows: [
        { name: 'Alice', note: 'First line' },
        { name: 'Bob', note: 'Second line' },
      ],
    });

    expect(csv).toContain('Name,Note');
    expect(csv).toContain('Alice,First line');
    expect(csv).toContain('Bob,Second line');
  });

  it('escapes quotes and commas', () => {
    const csv = buildCsvContent({
      columns: [
        { label: 'Title', value: (row: { title: string }) => row.title },
      ],
      rows: [
        { title: 'He said, "Hello"' },
      ],
    });

    expect(csv).toContain('"He said, ""Hello"""');
  });
});

