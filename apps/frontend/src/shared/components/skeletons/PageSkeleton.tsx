import { For, type Component } from 'solid-js';

type PageSkeletonProps = {
  sections?: number;
};

export const PageSkeleton: Component<PageSkeletonProps> = (props) => {
  const sections = Math.max(1, props.sections ?? 3);
  return (
    <div class="flex flex-col gap-6">
      <div class="h-10 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div class="h-6 w-80 animate-pulse rounded bg-slate-100" />
      <div class="grid gap-4 md:grid-cols-2">
        <For each={Array.from({ length: sections })}>
          {() => <div class="h-48 animate-pulse rounded-2xl bg-slate-100" />}
        </For>
      </div>
    </div>
  );
};
