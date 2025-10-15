import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';

type SparklinePoint = {
  value: number;
};

type SparklineProps = {
  points: SparklinePoint[];
  width?: number;
  height?: number;
};

export const Sparkline: Component<SparklineProps> = (props) => {
  const width = props.width ?? 180;
  const height = props.height ?? 48;
  const points = createMemo(() => props.points ?? []);

  const values = createMemo(() => points().map((point) => point.value));
  const min = createMemo(() => {
    const list = values();
    return list.length ? Math.min(...list) : 0;
  });
  const max = createMemo(() => {
    const list = values();
    return list.length ? Math.max(...list) : 0;
  });
  const range = createMemo(() => {
    const delta = max() - min();
    return delta === 0 ? 1 : delta;
  });

  const hashString = (input: string) => {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const path = createMemo(() =>
    points()
      .map((point, index, list) => {
        const x = (index / Math.max(1, list.length - 1)) * width;
        const y = height - ((point.value - min()) / range()) * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ')
  );

  const gradientId = createMemo(() => `sparkline-${hashString(path()).toString(16)}`);

  const view = createMemo(() => {
    const data = points();
    if (!data.length) {
      return <div class="text-xs text-slate-400">No data yet</div>;
    }

    if (data.length === 1) {
      const value = data[0]?.value ?? 0;
      return (
        <svg width={width} height={height} role="presentation">
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="currentColor"
            stroke-width={1}
            class="text-slate-300"
          />
          <circle cx={width} cy={height / 2} r={3} class="fill-emerald-500" />
          <title>{value}</title>
        </svg>
      );
    }

    return (
      <svg width={width} height={height} role="presentation">
        <defs>
          <linearGradient id={gradientId()} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="text-emerald-400" stop-color="currentColor" stop-opacity="0.4" />
            <stop offset="100%" class="text-emerald-200" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path()} L ${width} ${height} L 0 ${height} Z`}
          fill={`url(#${gradientId()})`}
          class="text-emerald-400/40"
        />
        <path d={path()} fill="none" stroke-width={2} class="stroke-emerald-500" />
        {data.map((point, index, list) => {
          const x = (index / Math.max(1, list.length - 1)) * width;
          const y = height - ((point.value - min()) / range()) * height;
          return <circle cx={x} cy={y} r={2.5} class="fill-white stroke-emerald-500 stroke-2" />;
        })}
      </svg>
    );
  });

  return <>{view()}</>;
};
