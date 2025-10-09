import { Component } from 'solid-js';
import { Button } from '~/components/ui/button';

const EmptyHero: Component<{ onCreate: () => void }> = (props) => {
  return (
    <div class="relative flex h-full w-full items-center justify-center">
      <div class="flex w-full max-w-xl flex-col items-center gap-6 rounded-3xl border border-slate-200/60 bg-white/80 px-12 py-16 text-center shadow-floating">
        <div class="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100">
          <span class="text-4xl">🤖</span>
        </div>
        <div class="space-y-2">
          <h1 class="text-3xl font-semibold text-slate-900">Let’s build your first sequence playground!</h1>
          <p class="text-base text-subtle">
            Start by creating an income source to collect your streams of revenue. Drag and connect
            nodes to automate your money map.
          </p>
        </div>
        <Button
          class="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] shadow-floating"
          onClick={props.onCreate}
        >
          Start building
        </Button>
      </div>
    </div>
  );
};

export default EmptyHero;
