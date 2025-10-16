type CsvColumn<T> = {
  label: string;
  value: (row: T) => unknown;
};

const escapeCsvValue = (input: unknown): string => {
  const value = input == null ? '' : String(input);
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
};

export type CsvOptions<T> = {
  filename: string;
  columns: Array<CsvColumn<T>>;
  rows: T[];
};

export const buildCsvContent = <T>(options: Pick<CsvOptions<T>, 'columns' | 'rows'>): string => {
  const header = options.columns.map((column) => escapeCsvValue(column.label)).join(',');
  const lines = options.rows.map((row) =>
    options.columns
      .map((column) => escapeCsvValue(column.value(row)))
      .join(',')
  );
  return [header, ...lines].join('\r\n');
};

export const downloadCsv = <T>(options: CsvOptions<T>) => {
  if (typeof window === 'undefined') {
    return;
  }

  const content = buildCsvContent({ columns: options.columns, rows: options.rows });
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

