import { For, type Component } from 'solid-js';

type StatSkeletonProps = {
  count?: number;
};

export const StatSkeleton: Component<StatSkeletonProps> = (props) => {
  const count = Math.max(1, props.count ?? 3);
  return (
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <For each={Array.from({ length: count })}>
        {() => (
          <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
            <div class="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div class="h-8 w-32 animate-pulse rounded bg-slate-200" />
            <div class="h-3 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        )}
      </For>
    </div>
  );
};
