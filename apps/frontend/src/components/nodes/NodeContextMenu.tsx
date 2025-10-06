import { Component } from 'solid-js';

const NodeContextMenu: Component<{ onDuplicate: () => void; onDelete: () => void; onOpenDrawer: () => void }> = (
  props,
) => {
  return (
    <div class="w-44 rounded-xl border border-slate-200/70 bg-white py-2 text-sm shadow-floating">
      <button class="block w-full px-3 py-2 text-left text-slate-700 transition hover:bg-slate-50" onClick={props.onOpenDrawer}>
        Open details
      </button>
      <button class="block w-full px-3 py-2 text-left text-slate-700 transition hover:bg-slate-50" onClick={props.onDuplicate}>
        Duplicate
      </button>
      <button class="block w-full px-3 py-2 text-left text-rose-600 transition hover:bg-rose-50" onClick={props.onDelete}>
        Delete
      </button>
    </div>
  );
};

export default NodeContextMenu;
