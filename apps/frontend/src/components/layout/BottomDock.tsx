import { Component, For, Show, createSignal } from 'solid-js';
import { clsx } from 'clsx';

type DockMenuItem = {
  id: string;
  label: string;
  description: string;
};

type BottomDockProps = {
  zoomPercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLinkNodes?: () => void;
  onCreateNode?: (item: DockMenuItem) => void;
  menuItems?: DockMenuItem[];
};

const bubbleClass = clsx(
  'pointer-events-auto flex items-center gap-4 rounded-full border border-slate-200/80 bg-white/95',
  'px-7 py-3 text-sm font-medium text-slate-700 shadow-floating backdrop-blur'
);

const ghostButton =
  'rounded-full border border-slate-200/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20';
const darkButton =
  'flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-floating transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/40';

const BottomDock: Component<BottomDockProps> = (props) => {
  const zoomLabel = () => `${Math.round(props.zoomPercent ?? 100)}%`;
  const [open, setOpen] = createSignal(false);
  const items = () => props.menuItems ?? [];
  const menuId = 'dock-create-menu';

  const handleNewClick = () => {
    if (items().length === 0) {
      props.onCreateNode?.({ id: 'node', label: 'Node', description: '' });
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleSelect = (item: DockMenuItem) => {
    setOpen(false);
    props.onCreateNode?.(item);
  };

  return (
    <div class="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
      <div class={bubbleClass}>
        <div class="relative">
          <button
            type="button"
            class={darkButton}
            aria-haspopup="menu"
            aria-expanded={open() ? 'true' : 'false'}
            aria-controls={menuId}
            onClick={handleNewClick}
          >
            <span class="text-base leading-none">＋</span>
            <span class="tracking-[0.18em]">New</span>
          </button>
          <Show when={open() && items().length > 0}>
            <div
              id={menuId}
              role="menu"
              class="absolute left-1/2 bottom-full z-10 mb-3 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-floating"
            >
              <div class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Create New
              </div>
              <div class="flex flex-col">
                <For each={items()}>
                  {(item) => (
                    <button
                      type="button"
                      class="flex flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50"
                      role="menuitem"
                      onClick={() => handleSelect(item)}
                    >
                      <span class="text-sm font-semibold text-slate-800">{item.label}</span>
                      <span class="text-xs text-subtle">{item.description}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
        <div class="flex items-center gap-2 text-slate-500">
          <button type="button" class={ghostButton} onClick={props.onLinkNodes} aria-label="Link selected nodes">
            Link
          </button>
          <button type="button" class={ghostButton} onClick={props.onZoomOut} aria-label="Zoom out">
            Zoom -
          </button>
          <button type="button" class={ghostButton} onClick={props.onZoomIn} aria-label="Zoom in">
            Zoom +
          </button>
          <span class="ml-2 text-xs text-subtle">Zoom {zoomLabel()}</span>
        </div>
      </div>
    </div>
  );
};

export default BottomDock;
export type { DockMenuItem };
