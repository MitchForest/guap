import { Component } from 'solid-js';
import { Button } from '~/components/ui/button';

const NodeContextMenu: Component<{ onDuplicate: () => void; onDelete: () => void; onOpenDrawer: () => void }> = (
  props,
) => {
  return (
    <div class="w-44 rounded-xl border border-slate-200/70 bg-white py-2 text-sm shadow-floating">
      <Button
        type="button"
        variant="ghost"
        class="block w-full justify-start rounded-none px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
        onClick={props.onOpenDrawer}
      >
        Open details
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="block w-full justify-start rounded-none px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
        onClick={props.onDuplicate}
      >
        Duplicate
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="block w-full justify-start rounded-none px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
        onClick={props.onDelete}
      >
        Delete
      </Button>
    </div>
  );
};

export default NodeContextMenu;
