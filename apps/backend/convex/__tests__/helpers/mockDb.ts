type AnyRecord = Record<string, any> & { _id: string };

type RecordMap = Map<string, AnyRecord[]>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const getByPath = (record: AnyRecord, path: string) => {
  if (!path.includes('.')) {
    return record[path];
  }
  return path.split('.').reduce((acc: any, key) => (acc == null ? acc : acc[key]), record);
};

const sortValueFor = (record: AnyRecord) => {
  if (typeof record.occurredAt === 'number') return record.occurredAt;
  if (typeof record.requestedAt === 'number') return record.requestedAt;
  if (typeof record.capturedAt === 'number') return record.capturedAt;
  if (typeof record.createdAt === 'number') return record.createdAt;
  if (typeof record.updatedAt === 'number') return record.updatedAt;
  return 0;
};

class MockQuery {
  private readonly filters: Array<(record: AnyRecord) => boolean> = [];
  private orderDirection: 'asc' | 'desc' | null = null;

  constructor(
    private readonly table: string,
    private readonly tables: RecordMap
  ) {}

  withIndex(_name: string, builder: (query: { eq: (field: string, value: unknown) => any }) => unknown) {
    const build = {
      eq: (field: string, value: unknown) => {
        this.filters.push((record) => getByPath(record, field) === value);
        return build;
      },
    };
    builder(build);
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((record) => getByPath(record, field) === value);
    return this;
  }

  order(direction: 'asc' | 'desc') {
    this.orderDirection = direction;
    return this;
  }

  filter(predicate: (record: AnyRecord) => boolean) {
    this.filters.push(predicate);
    return this;
  }

  take(limit: number) {
    return this.apply().slice(0, limit);
  }

  collect() {
    return this.apply();
  }

  unique() {
    const results = this.apply();
    if (results.length > 1) {
      throw new Error('Expected unique result');
    }
    return results[0] ?? null;
  }

  first() {
    return this.apply()[0] ?? null;
  }

  private apply() {
    const table = this.tables.get(this.table) ?? [];
    let results = table.map((record) => clone(record));
    for (const filter of this.filters) {
      results = results.filter(filter);
    }
    if (this.orderDirection) {
      const direction = this.orderDirection;
      results.sort((a, b) => {
        const lhs = sortValueFor(a);
        const rhs = sortValueFor(b);
        return direction === 'desc' ? rhs - lhs : lhs - rhs;
      });
    }
    return results;
  }
}

class MockDb {
  private readonly tables: RecordMap = new Map();
  private readonly idLookup = new Map<string, AnyRecord>();
  private counter = 0;

  insert(table: string, doc: Record<string, unknown>) {
    const record = { _id: `${table}:${++this.counter}`, ...clone(doc) } as AnyRecord;
    const bucket = this.ensureTable(table);
    bucket.push(record);
    this.idLookup.set(record._id, record);
    return record._id;
  }

  patch(id: string, patch: Record<string, unknown>) {
    const record = this.idLookup.get(id);
    if (!record) {
      throw new Error(`Record ${id} not found`);
    }
    Object.assign(record, clone(patch));
  }

  get(id: string) {
    const record = this.idLookup.get(id);
    return record ? clone(record) : null;
  }

  delete(id: string) {
    const record = this.idLookup.get(id);
    if (!record) {
      return;
    }
    for (const records of this.tables.values()) {
      const index = records.findIndex((item) => item._id === id);
      if (index >= 0) {
        records.splice(index, 1);
        break;
      }
    }
    this.idLookup.delete(id);
  }

  query(table: string) {
    return new MockQuery(table, this.tables);
  }

  getTable(table: string) {
    return (this.tables.get(table) ?? []).map((record) => clone(record));
  }

  private ensureTable(table: string) {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return this.tables.get(table)!;
  }
}

export const createMockDb = () => new MockDb();
