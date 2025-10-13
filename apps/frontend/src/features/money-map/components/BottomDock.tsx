import { Component } from 'solid-js';
import { clsx } from 'clsx';
import { Button } from '~/shared/components/ui/button';

type BottomDockProps = {
  onAddIncome?: () => void;
  onAddAccount?: () => void;
  onAddPod?: () => void;
  onStartFlow?: () => void;
};

const bubbleClass = clsx(
  'pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 shadow-floating backdrop-blur',
  'px-6 py-3 text-sm font-medium text-slate-700'
);

const pillButtonClass =
  'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]';

const BottomDock: Component<BottomDockProps> = (props) => {
  return (
    <div class="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
      <div class={bubbleClass}>
        <Button
          type="button"
          class={clsx(pillButtonClass, 'gap-2 bg-slate-900 text-white shadow-floating hover:bg-slate-800')}
          onClick={props.onAddIncome}
          title="Add income source"
        >
          <span class="text-base">💰</span>
          <span>Income</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          class={clsx(
            pillButtonClass,
            'gap-2 border-slate-200/80 bg-white/95 text-slate-600 hover:border-slate-300 hover:text-slate-900'
          )}
          onClick={props.onAddAccount}
          title="Add account"
        >
          <span class="text-base">🏦</span>
          <span>Account</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          class={clsx(
            pillButtonClass,
            'gap-2 border-slate-200/80 bg-white/95 text-slate-600 hover:border-slate-300 hover:text-slate-900'
          )}
          onClick={props.onAddPod}
          title="Add goal or category"
        >
          <span class="text-base">🎯</span>
          <span>Pod</span>
        </Button>
      </div>
    </div>
  );
};

export default BottomDock;
export type { BottomDockProps };
