import { Component, createSignal, onMount } from 'solid-js';
import { Motion } from 'solid-motionone';

type ReactiveNodeProps = {
  label: string;
  value: string;
  color: string;
  delay?: number;
  onImpact?: () => void;
};

const ReactiveNode: Component<ReactiveNodeProps> = (props) => {
  const [isImpacted, setIsImpacted] = createSignal(false);
  const [displayValue, setDisplayValue] = createSignal(props.value);

  // Method to trigger impact animation
  const triggerImpact = () => {
    setIsImpacted(true);
    setTimeout(() => setIsImpacted(false), 600);
    props.onImpact?.();
  };

  // Expose method to parent
  if (typeof window !== 'undefined') {
    (window as any)[`impactNode_${props.label}`] = triggerImpact;
  }

  onMount(() => {
    setDisplayValue(props.value);
  });

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: isImpacted() ? [1, 1.15, 1] : 1,
        y: 0 
      }}
      transition={{ 
        duration: isImpacted() ? 0.5 : 0.6,
        delay: props.delay || 0,
        easing: isImpacted() ? [0.34, 1.56, 0.64, 1] : [0.16, 1, 0.3, 1]
      }}
      class="group relative"
    >
      <div
        class={`relative flex items-center justify-between rounded-2xl border-2 p-4 transition-all duration-300 ${props.color}`}
        classList={{
          'shadow-lg': isImpacted(),
          'shadow-md': !isImpacted(),
        }}
      >
        {/* Glow effect on impact */}
        {isImpacted() && (
          <div class="absolute inset-0 rounded-2xl bg-white/40 animate-ping" />
        )}
        
        <div class="relative flex items-center gap-3">
          <div class="size-3 rounded-full bg-orange-400 transition-transform group-hover:scale-110" />
          <span class="font-semibold text-slate-900">{props.label}</span>
        </div>
        <Motion.span
          animate={{ scale: isImpacted() ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.4 }}
          class="relative font-bold text-slate-900"
        >
          {displayValue()}
        </Motion.span>
      </div>

      {/* Particle impact sparkles */}
      {isImpacted() && (
        <div class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5 }}
            class="size-16 rounded-full bg-yellow-400/30 blur-xl"
          />
        </div>
      )}
    </Motion.div>
  );
};

export default ReactiveNode;

