import { For, type Component } from 'solid-js';

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
};

export const TableSkeleton: Component<TableSkeletonProps> = (props) => {
  const rows = Math.max(3, props.rows ?? 5);
  const columns = Math.max(3, props.columns ?? 4);
  return (
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div class="h-14 animate-pulse bg-slate-100" />
      <div class="divide-y divide-slate-100">
        <For each={Array.from({ length: rows })}>
          {(_, index) => (
            <div class="grid animate-pulse gap-4 px-4 py-3 md:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
              <For each={Array.from({ length: columns })}>
                {() => (
                  <div class="h-4 rounded bg-slate-100">
                    <span class="sr-only">Row {index() + 1}</span>
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
