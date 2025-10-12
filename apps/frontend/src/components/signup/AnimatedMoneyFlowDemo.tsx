import { Component, For, createSignal, onMount, onCleanup } from 'solid-js';
import { Motion } from 'solid-motionone';
import ReactiveNode from './ReactiveNode';
import MoneyParticle from './MoneyParticle';
import SimulationTimeline from './SimulationTimeline';

type Allocation = {
  label: string;
  percentage: number;
  color: string;
  value: string;
};

const AnimatedMoneyFlowDemo: Component = () => {
  const [particles, setParticles] = createSignal<Array<{ id: number; targetIndex: number }>>([]);
  const [particleId, setParticleId] = createSignal(0);

  const incomeAmount = 16000;
  const allocations: Allocation[] = [
    { label: 'Profit', percentage: 25, color: 'bg-orange-100 border-orange-200', value: '$1429' },
    { label: 'Expenses', percentage: 25, color: 'bg-orange-100 border-orange-200', value: '$0' },
    { label: 'Taxes', percentage: 15, color: 'bg-orange-100 border-orange-200', value: '$0' },
    { label: 'Debt repayment', percentage: 35, color: 'bg-orange-100 border-orange-200', value: '$0' },
  ];

  // Positions for particle animation
  const incomePosition = { x: 300, y: 80 };
  const getDestinationPosition = (index: number) => ({
    x: 460,
    y: 250 + (index * 90),
  });

  let animationInterval: number;

  // Function to emit particles
  const emitParticles = () => {
    allocations.forEach((allocation, index) => {
      // Calculate delay based on percentage (higher % = more particles = shorter delays)
      const baseDelay = index * 400;
      const particleCount = Math.ceil(allocation.percentage / 10);

      for (let i = 0; i < particleCount; i++) {
        setTimeout(() => {
          const id = particleId();
          setParticleId(id + 1);
          setParticles(prev => [...prev, { id, targetIndex: index }]);

          // Remove particle after animation completes
          setTimeout(() => {
            setParticles(prev => prev.filter(p => p.id !== id));
            // Trigger node impact
            triggerNodeImpact(allocation.label);
          }, 1500 + (i * 100));
        }, baseDelay + (i * 200));
      }
    });
  };

  const triggerNodeImpact = (label: string) => {
    if (typeof window !== 'undefined') {
      const impactFn = (window as any)[`impactNode_${label}`];
      if (impactFn) impactFn();
    }
  };

  onMount(() => {
    // Start animation loop after initial delay
    setTimeout(() => {
      emitParticles();
      // Repeat every 4 seconds
      animationInterval = window.setInterval(() => {
        emitParticles();
      }, 4000);
    }, 800);
  });

  onCleanup(() => {
    if (animationInterval) {
      clearInterval(animationInterval);
    }
  });

  return (
    <div class="relative h-full w-full bg-dot-grid p-8">
      <div class="relative h-full w-full max-w-2xl mx-auto flex flex-col justify-between">
        {/* Income Source Node */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          class="relative"
        >
          <div class="rounded-2xl border-2 border-teal-200 bg-teal-50 p-6 shadow-lg">
            <Motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, easing: 'ease-in-out' }}
            >
              <div class="text-sm font-medium text-slate-600">My income</div>
              <div class="mt-2 text-4xl font-bold text-slate-900">${incomeAmount.toLocaleString()}</div>
            </Motion.div>
          </div>

          {/* Pulsing glow effect */}
          <Motion.div
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2, repeat: Infinity }}
            class="absolute inset-0 rounded-2xl bg-teal-200/30 blur-xl -z-10"
          />
        </Motion.div>

        {/* Flow Connections & Destination Nodes */}
        <div class="relative flex-1 flex flex-col justify-center space-y-4 pl-8 mt-8">
          {/* Vertical connection line */}
          <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-300" />

          <For each={allocations}>
            {(allocation, index) => (
              <div class="flex items-center gap-4">
                {/* Connection dot */}
                <div class="relative -ml-[1.875rem] size-6 rounded-full border-4 border-white bg-slate-900 z-10" />

                {/* Percentage badge */}
                <div class="flex items-center gap-2">
                  <Motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 + (index() * 0.1) }}
                    class="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {allocation.percentage}%
                  </Motion.div>
                  <svg class="size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Destination Node */}
                <div class="flex-1">
                  <ReactiveNode
                    label={allocation.label}
                    value={allocation.value}
                    color={allocation.color}
                    delay={0.4 + (index() * 0.1)}
                  />
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Money Particles */}
        <For each={particles()}>
          {(particle) => (
            <MoneyParticle
              startX={incomePosition.x}
              startY={incomePosition.y}
              endX={getDestinationPosition(particle.targetIndex).x}
              endY={getDestinationPosition(particle.targetIndex).y}
              delay={0}
              duration={1.5}
            />
          )}
        </For>

        {/* Simulation Timeline */}
        <div class="mt-12">
          <SimulationTimeline
            monthlyIncome={incomeAmount}
            targetAmount={100000}
            estimatedMonths={88}
          />
        </div>
      </div>
    </div>
  );
};

export default AnimatedMoneyFlowDemo;

