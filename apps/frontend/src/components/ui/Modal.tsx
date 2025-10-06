import { Component, JSX, Show, createEffect } from 'solid-js';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
};

const Modal: Component<ModalProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  createEffect(() => {
    if (props.open && dialogRef) {
      dialogRef.focus();
    }
  });

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm" role="presentation">
        <div
          ref={dialogRef}
          class="relative w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-8 shadow-floating focus:outline-none"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <button
            type="button"
            class="absolute right-4 top-4 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            aria-label="Close dialog"
            onClick={props.onClose}
          >
            Close
          </button>
          {props.children}
        </div>
      </div>
    </Show>
  );
};

export default Modal;
