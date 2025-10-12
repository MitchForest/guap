import { Component } from 'solid-js';

type BillingToggleProps = {
  isYearly: boolean;
  onToggle: (isYearly: boolean) => void;
};

const BillingToggle: Component<BillingToggleProps> = (props) => {
  return (
    <div class="flex items-center justify-center gap-4">
      <button
        type="button"
        class="text-base font-semibold transition-colors"
        classList={{
          'text-slate-900': !props.isYearly,
          'text-slate-500': props.isYearly,
        }}
        onClick={() => props.onToggle(false)}
      >
        Monthly
      </button>
      
      <button
        type="button"
        class="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
        classList={{
          'bg-slate-900': props.isYearly,
          'bg-slate-300': !props.isYearly,
        }}
        onClick={() => props.onToggle(!props.isYearly)}
      >
        <span
          class="inline-block size-6 rounded-full bg-white shadow-md transition-transform"
          classList={{
            'translate-x-7': props.isYearly,
            'translate-x-1': !props.isYearly,
          }}
        />
      </button>
      
      <button
        type="button"
        class="flex items-center gap-2 text-base font-semibold transition-colors"
        classList={{
          'text-slate-900': props.isYearly,
          'text-slate-500': !props.isYearly,
        }}
        onClick={() => props.onToggle(true)}
      >
        Yearly
        <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
          Save 16%
        </span>
      </button>
    </div>
  );
};

export default BillingToggle;

