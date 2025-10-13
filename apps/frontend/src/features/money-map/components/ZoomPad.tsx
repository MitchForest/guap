import { Component } from 'solid-js';
import { Button } from '~/shared/components/ui/button';

type ZoomPadProps = {
  zoomPercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
};

const ZoomPad: Component<ZoomPadProps> = (props) => {
  const label = () => `${Math.round(props.zoomPercent ?? 100)}%`;
  return (
    <div class="pointer-events-none absolute bottom-6 right-6 flex flex-col items-center gap-2">
      <div class="pointer-events-auto flex flex-col items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-3 py-3 shadow-floating backdrop-blur">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          class="rounded-full border border-slate-200/80 bg-white/95 text-base font-semibold text-slate-700 shadow-floating hover:border-slate-300 hover:text-slate-900"
          aria-label="Zoom in"
          onClick={props.onZoomIn}
        >
          ＋
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          class="rounded-full border border-slate-200/80 bg-white/95 text-base font-semibold text-slate-700 shadow-floating hover:border-slate-300 hover:text-slate-900"
          aria-label="Zoom out"
          onClick={props.onZoomOut}
        >
          －
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          class="rounded-full border border-slate-200/80 bg-white/95 text-base font-semibold text-slate-700 shadow-floating hover:border-slate-300 hover:text-slate-900"
          aria-label="Reset zoom"
          onClick={props.onReset}
        >
          ⤾
        </Button>
      </div>
      <span class="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
        {label()}
      </span>
    </div>
  );
};

export default ZoomPad;
export type { ZoomPadProps };
