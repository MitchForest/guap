import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  createSolidTable,
} from '@tanstack/solid-table';
import { Accessor, For, Show, createSignal, type JSX } from 'solid-js';

export type DataTableViewOption = {
  id: string;
  label: string;
  icon?: JSX.Element;
};

export type DataTableToolbar<TItem> = {
  search?: {
    placeholder?: string;
    value: Accessor<string>;
    onChange: (value: string) => void;
  };
  filters?: Array<{
    id: string;
    label: string;
    active: boolean;
    onToggle: () => void;
  }>;
  actions?: JSX.Element;
  summary?: (items: TItem[]) => JSX.Element;
  view?: {
    options: DataTableViewOption[];
    value: Accessor<string>;
    onChange: (id: string) => void;
  };
};

export type DataTableProps<TItem> = {
  data: TItem[];
  columns: ColumnDef<TItem, unknown>[];
  toolbar?: DataTableToolbar<TItem>;
  empty?: JSX.Element;
  initialSorting?: SortingState;
  onRowClick?: (item: TItem) => void;
};

export const DataTable = <TItem,>(props: DataTableProps<TItem>) => {
  const [sorting, setSorting] = createSignal<SortingState>(props.initialSorting ?? []);

  const table = createSolidTable<TItem>({
    get data() {
      return props.data;
    },
    get columns() {
      return props.columns;
    },
    state: {
      get sorting() {
        return sorting();
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const activeView = () => props.toolbar?.view?.value?.();

  return (
    <div class={`flex flex-col gap-4 ${activeView() === 'compact' ? 'text-sm' : ''}`}
      data-view={activeView() ?? 'list'}
    >
      <Show when={props.toolbar}>
        {(toolbarAccessor) => {
          const toolbar = toolbarAccessor();
          return (
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-1 items-center gap-2">
                <Show when={toolbar.search}>
                  {(search) => (
                    <input
                      type="search"
                      value={search().value()}
                      onInput={(event) => search().onChange(event.currentTarget.value)}
                      placeholder={search().placeholder ?? 'Search'}
                      class="h-10 w-full max-w-xs rounded-lg border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none"
                    />
                  )}
                </Show>
                <Show when={toolbar.filters}>
                  {(filtersAccessor) => (
                    <div class="flex flex-wrap items-center gap-2">
                      <For each={filtersAccessor()}>
                        {(filter) => (
                          <button
                            type="button"
                            onClick={filter.onToggle}
                            class={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                              filter.active
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                            }`}
                          >
                            {filter.label}
                          </button>
                        )}
                      </For>
                    </div>
                  )}
                </Show>
              </div>
              <div class="flex items-center gap-2">
                <Show when={toolbar.view}>
                  {(viewAccessor) => {
                    const view = viewAccessor();
                    return (
                    <div class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                        <For each={view.options}>
                          {(option) => {
                            const isActive = () => view.value() === option.id;
                            return (
                              <button
                                type="button"
                                onClick={() => view.onChange(option.id)}
                                class={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  isActive()
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {option.icon ? <span>{option.icon}</span> : null}
                                <span>{option.label}</span>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                    );
                  }}
                </Show>
                <Show when={toolbar.actions}>{(actions) => <div>{actions()}</div>}</Show>
              </div>
            </div>
          );
        }}
      </Show>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50">
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
                      <th
                        colSpan={header.colSpan}
                        class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        style={{
                          width: (
                            header.column.columnDef.meta as { width?: string } | undefined
                          )?.width,
                        }}
                      >
                        <Show when={!header.isPlaceholder}>
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 text-slate-600 transition hover:text-slate-900"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!header.column.getCanSort()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <Show when={header.column.getIsSorted() === 'asc'}>↑</Show>
                            <Show when={header.column.getIsSorted() === 'desc'}>↓</Show>
                          </button>
                        </Show>
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm text-slate-700">
            <Show
              when={table.getRowModel().rows.length > 0}
              fallback={
                <tr>
                  <td colSpan={table.getAllLeafColumns().length} class="px-4 py-8 text-center text-sm text-slate-500">
                    {props.empty ?? 'No records available yet.'}
                  </td>
                </tr>
              }
            >
              <For each={table.getRowModel().rows}>
                {(row) => (
                  <tr
                    class={`hover:bg-slate-50 ${props.onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (props.onRowClick) {
                        props.onRowClick(row.original as TItem);
                      }
                    }}
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td class="px-4 py-3 align-middle text-sm text-slate-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      <Show when={props.toolbar?.summary}>
        {(summaryAccessor) => {
          const summary = summaryAccessor();
          return <div class="text-xs text-slate-500">{summary(props.data)}</div>;
        }}
      </Show>
    </div>
  );
};
