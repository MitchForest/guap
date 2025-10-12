import { Component, For } from 'solid-js';

type FlowNode = {
  id: string;
  label: string;
  icon: string;
  accent: string;
  x: number;
  y: number;
};

type FlowConnection = {
  from: string;
  to: string;
  label?: string;
};

const MoneyFlowDiagram: Component = () => {
  const nodes: FlowNode[] = [
    { id: 'income', label: 'Monthly Income', icon: '💰', accent: '#2563eb', x: 50, y: 20 },
    { id: 'checking', label: 'Checking', icon: '🏦', accent: '#1d4ed8', x: 15, y: 60 },
    { id: 'savings', label: 'Savings', icon: '🪙', accent: '#f97316', x: 50, y: 60 },
    { id: 'investing', label: 'Investing', icon: '📈', accent: '#16a34a', x: 85, y: 60 },
  ];

  const connections: FlowConnection[] = [
    { from: 'income', to: 'checking', label: '60%' },
    { from: 'income', to: 'savings', label: '30%' },
    { from: 'income', to: 'investing', label: '10%' },
  ];

  const getNodePosition = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId);
  };

  return (
    <div class="relative aspect-[4/3] w-full">
      <svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Draw connections */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
          </marker>
        </defs>
        <For each={connections}>
          {(conn) => {
            const from = getNodePosition(conn.from);
            const to = getNodePosition(conn.to);
            if (!from || !to) return null;

            const startY = from.y + 8;
            const endY = to.y - 2;
            const midY = (startY + endY) / 2;

            return (
              <g>
                {/* Curved path */}
                <path
                  d={`M ${from.x} ${startY} Q ${from.x} ${midY}, ${to.x} ${endY}`}
                  fill="none"
                  stroke="#cbd5e1"
                  stroke-width="0.5"
                  marker-end="url(#arrowhead)"
                  class="animate-pulse"
                  style={{ "animation-duration": "3s" }}
                />
                {/* Label */}
                {conn.label && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={midY}
                    text-anchor="middle"
                    class="fill-slate-500 text-[3px] font-semibold"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          }}
        </For>

        {/* Draw nodes */}
        <For each={nodes}>
          {(node) => (
            <g>
              {/* Node card */}
              <rect
                x={node.x - 10}
                y={node.y - 4}
                width="20"
                height="8"
                rx="2"
                fill="white"
                stroke={node.accent}
                stroke-width="0.3"
                class="drop-shadow-sm"
              />
              {/* Icon */}
              <text x={node.x - 8} y={node.y + 1} class="text-[4px]">
                {node.icon}
              </text>
              {/* Label */}
              <text x={node.x + 1} y={node.y + 1} class="fill-slate-700 text-[2.5px] font-semibold">
                {node.label}
              </text>
            </g>
          )}
        </For>
      </svg>
    </div>
  );
};

export default MoneyFlowDiagram;

