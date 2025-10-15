import { createMemo, type Component } from 'solid-js';
import type { NeedsWantsBreakdown } from '../state/createSpendData';
import { formatCurrency } from '~/shared/utils/format';

export type NeedsWantsDonutProps = {
  breakdown: NeedsWantsBreakdown;
};

const COLORS = {
  needs: '#0ea5e9',
  wants: '#f97316',
  neutral: '#cbd5f5',
};

export const NeedsWantsDonut: Component<NeedsWantsDonutProps> = (props) => {
  const segments = createMemo(() => {
    const total = props.breakdown.total || 1;
    const needsAngle = (props.breakdown.needs / total) * 360;
    const wantsAngle = (props.breakdown.wants / total) * 360;

    return {
      needsEnd: needsAngle,
      wantsEnd: needsAngle + wantsAngle,
    };
  });

  const style = createMemo(() => {
    const seg = segments();
    return {
      background: `conic-gradient(${COLORS.needs} 0deg ${seg.needsEnd}deg, ${COLORS.wants} ${seg.needsEnd}deg ${seg.wantsEnd}deg, ${COLORS.neutral} ${seg.wantsEnd}deg 360deg)`,
    } as const;
  });

  const totalLabel = createMemo(() => formatCurrency(props.breakdown.total));

  return (
    <div class="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="relative flex h-36 w-36 items-center justify-center">
        <div class="h-full w-full rounded-full" style={style()} />
        <div class="absolute flex h-20 w-20 items-center justify-center rounded-full bg-white text-center text-sm font-semibold text-slate-900">
          {totalLabel()}
        </div>
      </div>
      <ul class="flex w-full flex-col gap-2 text-sm text-slate-600">
        <li class="flex items-center justify-between">
          <span class="inline-flex items-center gap-2"><span class="size-2.5 rounded-full" style={{ 'background-color': COLORS.needs }} />Needs</span>
          <span>{formatCurrency(props.breakdown.needs)}</span>
        </li>
        <li class="flex items-center justify-between">
          <span class="inline-flex items-center gap-2"><span class="size-2.5 rounded-full" style={{ 'background-color': COLORS.wants }} />Wants</span>
          <span>{formatCurrency(props.breakdown.wants)}</span>
        </li>
        <li class="flex items-center justify-between">
          <span class="inline-flex items-center gap-2"><span class="size-2.5 rounded-full" style={{ 'background-color': COLORS.neutral }} />Neutral</span>
          <span>{formatCurrency(props.breakdown.neutral)}</span>
        </li>
      </ul>
    </div>
  );
};
