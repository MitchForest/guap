import type { Component, JSX } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';

type DataStateStatus = 'idle' | 'loading' | 'error' | 'empty' | 'success';

type DataStateProps = {
  status: DataStateStatus;
  children?: JSX.Element;
  loadingFallback?: JSX.Element;
  errorFallback?: JSX.Element | ((message: string) => JSX.Element);
  emptyFallback?: JSX.Element;
  message?: string | null;
};

const DefaultLoading = () => (
  <div class="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-16 text-sm text-slate-500">
    Loading…
  </div>
);

const DefaultError = (props: { message?: string | null }) => (
  <div class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-sm text-rose-700">
    <span>Something went wrong.</span>
    <Show when={props.message}>
      {(msg) => <span class="text-xs text-rose-500">{msg()}</span>}
    </Show>
  </div>
);

const DefaultEmpty = () => (
  <div class="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-16 text-sm text-slate-500">
    Nothing to display yet.
  </div>
);

const renderErrorState = (props: DataStateProps) => {
  if (typeof props.errorFallback === 'function') {
    return props.errorFallback(props.message ?? '');
  }
  if (props.errorFallback) {
    return props.errorFallback;
  }
  return <DefaultError message={props.message} />;
};

export const DataState: Component<DataStateProps> = (props) => (
  <Switch>
    <Match when={props.status === 'loading'}>{props.loadingFallback ?? <DefaultLoading />}</Match>
    <Match when={props.status === 'error'}>{renderErrorState(props)}</Match>
    <Match when={props.status === 'empty'}>{props.emptyFallback ?? <DefaultEmpty />}</Match>
    <Match when={props.status === 'success'}>{props.children ?? null}</Match>
    <Match when={true}>{props.children ?? null}</Match>
  </Switch>
);
