import { Component } from 'solid-js';
import { Motion } from 'solid-motionone';

type SimulationTimelineProps = {
  monthlyIncome: number;
  targetAmount: number;
  estimatedMonths: number;
};

const SimulationTimeline: Component<SimulationTimelineProps> = (props) => {
  const years = Math.floor(props.estimatedMonths / 12);
  const months = props.estimatedMonths % 12;

  const milestones = [
    { label: 'Now', amount: 0, position: 0 },
    { label: 'Level 2', amount: 10000, position: 33 },
    { label: 'Level 3', amount: 50000, position: 66 },
    { label: 'Freedom', amount: props.targetAmount, position: 100 },
  ];

  // Current progress (for demo, show at ~10%)
  const currentProgress = 8;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.2 }}
      class="w-full space-y-4"
    >
      {/* Header */}
      <div class="space-y-1">
        <p class="text-sm font-medium text-slate-600">At current allocations:</p>
        <div class="flex items-baseline gap-2">
          <p class="text-2xl font-bold text-slate-900">
            Financial Freedom
          </p>
          <p class="text-lg font-semibold text-slate-600">
            (${(props.targetAmount / 1000).toFixed(0)}k)
          </p>
        </div>
        <Motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          class="text-lg font-semibold text-indigo-600"
        >
          {years} years {months > 0 && `${months} months`}
        </Motion.p>
      </div>

      {/* Timeline */}
      <div class="relative pt-8 pb-4">
        {/* Background track */}
        <div class="absolute top-8 left-0 right-0 h-1 rounded-full bg-slate-200" />

        {/* Animated progress */}
        <Motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${currentProgress}%` }}
          transition={{ duration: 2, delay: 1.8, easing: [0.16, 1, 0.3, 1] }}
          class="absolute top-8 left-0 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
        />

        {/* Milestones */}
        <div class="relative flex justify-between">
          {milestones.map((milestone, index) => (
            <Motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.4, 
                delay: 1.8 + (index * 0.1),
                easing: [0.34, 1.56, 0.64, 1]
              }}
              class="flex flex-col items-center"
              style={{ position: 'absolute', left: `${milestone.position}%`, transform: 'translateX(-50%)' }}
            >
              {/* Dot */}
              <div 
                class="relative z-10 size-4 rounded-full border-4 border-white bg-slate-900 shadow-md"
                classList={{
                  'bg-indigo-500': milestone.position <= currentProgress,
                }}
              />
              
              {/* Label */}
              <div class="mt-3 text-center">
                <p class="text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {milestone.label}
                </p>
                {milestone.amount > 0 && (
                  <p class="text-[10px] text-slate-500 whitespace-nowrap">
                    ${(milestone.amount / 1000).toFixed(0)}k
                  </p>
                )}
              </div>
            </Motion.div>
          ))}
        </div>

        {/* Current position indicator */}
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 2.5 }}
          class="absolute top-0"
          style={{ left: `${currentProgress}%`, transform: 'translateX(-50%)' }}
        >
          <div class="flex flex-col items-center">
            <div class="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
              You are here
            </div>
            <svg class="size-2 text-indigo-600" viewBox="0 0 8 8" fill="currentColor">
              <path d="M4 8L0 0h8z" />
            </svg>
          </div>
        </Motion.div>
      </div>

      {/* Footer message */}
      <Motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.8 }}
        class="text-sm text-slate-500 text-center"
      >
        Watch your wealth grow with smart automation
      </Motion.p>
    </Motion.div>
  );
};

export default SimulationTimeline;

