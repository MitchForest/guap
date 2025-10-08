import { Component } from 'solid-js';
import { clsx } from 'clsx';

type BottomDockProps = {
  onAddIncome?: () => void;
  onAddAccount?: () => void;
  onAddSubAccount?: () => void;
  onStartFlow?: () => void;
};

const bubbleClass = clsx(
  'pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 shadow-floating backdrop-blur',
  'px-6 py-3 text-sm font-medium text-slate-700'
);

const actionButton =
  'rounded-full border border-slate-200/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400';

const primaryButton = clsx(
  actionButton,
  'border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-900'
);

const BottomDock: Component<BottomDockProps> = (props) => {
  return (
    <div class="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
      <div class={bubbleClass}>
        <button type="button" class={primaryButton} onClick={props.onAddIncome}>
          Income
        </button>
        <button type="button" class={actionButton} onClick={props.onAddAccount}>
          Account
        </button>
        <button type="button" class={actionButton} onClick={props.onAddSubAccount}>
          Sub-account
        </button>
        <button type="button" class={actionButton} onClick={props.onStartFlow}>
          Flow
        </button>
      </div>
    </div>
  );
};

export default BottomDock;
export type { BottomDockProps };
