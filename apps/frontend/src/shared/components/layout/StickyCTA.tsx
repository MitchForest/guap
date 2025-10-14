import type { ParentComponent } from 'solid-js';

type StickyCTAProps = {
  alignment?: 'start' | 'center' | 'end';
};

const alignmentClass: Record<NonNullable<StickyCTAProps['alignment']>, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

export const StickyCTA: ParentComponent<StickyCTAProps> = (props) => (
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 md:p-6">
    <div
      class={`pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur ${alignmentClass[props.alignment ?? 'end']}`}
    >
      {props.children}
    </div>
  </div>
);
