import { Accessor, createResource } from 'solid-js';

type GuapQueryOptions<TKey, TValue> = {
  source: Accessor<TKey | null | undefined>;
  fetcher: (key: TKey) => Promise<TValue>;
  initialValue: TValue;
};

export const createGuapQuery = <TKey, TValue>(options: GuapQueryOptions<TKey, TValue>) => {
  const [resource, { refetch }] = createResource(
    options.source,
    async (key) => {
      if (key == null) {
        return options.initialValue;
      }
      return options.fetcher(key);
    },
    {
      initialValue: options.initialValue,
    }
  );

  const safeRefetch = async () => {
    const result = await refetch();
    if (result === undefined) {
      return options.initialValue;
    }
    return result as TValue;
  };

  return {
    data: () => resource() ?? options.initialValue,
    isLoading: () => resource.loading,
    error: () => resource.error,
    refetch: safeRefetch,
  };
};
