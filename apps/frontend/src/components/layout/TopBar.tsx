import { Component } from 'solid-js';
import { clsx } from 'clsx';

const badgeClass = clsx(
  'rounded-full bg-slate-900/95 text-white text-[10px] font-semibold',
  'tracking-[0.18em] uppercase px-3 py-1 shadow-floating'
);

const actionButton = 'rounded-xl border border-slate-200/80 px-4 py-2 text-xs font-semibold tracking-wide uppercase transition hover:border-slate-300 hover:text-slate-800';
const primaryButton = 'rounded-xl bg-slate-900/95 px-4 py-2 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-900';

const TopBar: Component = () => {
  return (
    <header class="flex h-[72px] items-center justify-between border-b border-slate-200/60 bg-white/95 px-8 backdrop-blur">
      <div class="flex items-center gap-4">
        <span class={badgeClass}>Canvas</span>
        <div class="leading-tight">
          <p class="text-sm font-semibold text-slate-900">Sequence Playground</p>
          <p class="text-xs text-subtle">Build and automate your money map</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class={actionButton}>Exit</button>
        <button class={primaryButton}>Save Canvas</button>
      </div>
    </header>
  );
};

export default TopBar;
