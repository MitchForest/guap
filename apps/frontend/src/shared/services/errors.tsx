import { createSignal, Show, type Component } from 'solid-js';

export const reportError = (error: unknown, context?: string) => {
  console.error(context ? `[${context}]` : '[Error]', error);
};

type FriendlyErrorMessageProps = {
  title?: string;
  details?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export const FriendlyErrorMessage: Component<FriendlyErrorMessageProps> = (props) => {
  const [isRetrying, setRetrying] = createSignal(false);

  const handleRetry = async () => {
    if (!props.onRetry) return;
    try {
      setRetrying(true);
      await props.onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <h3 class="text-sm font-semibold text-rose-700">{props.title ?? 'Something went wrong'}</h3>
      <Show when={props.details}>
        {(details) => <p class="max-w-md text-xs text-rose-500">{details()}</p>}
      </Show>
      <Show when={props.onRetry}>
        <button
          type="button"
          class="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
          onClick={handleRetry}
          disabled={isRetrying()}
        >
          {props.retryLabel ?? 'Try again'}
        </button>
      </Show>
    </div>
  );
};
