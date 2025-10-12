import { Component, For } from 'solid-js';
import { Motion } from 'solid-motionone';

const MiniMoneyAnimation: Component = () => {
  const particles = [
    { delay: 0, x: 20 },
    { delay: 0.5, x: 60 },
    { delay: 1, x: 100 },
  ];

  return (
    <div class="relative h-24 w-full overflow-hidden">
      {/* Subtle grid background */}
      <div 
        class="absolute inset-0 opacity-30"
        style={{
          "background-image": "radial-gradient(#94a3b8 1px, transparent 0)",
          "background-size": "16px 16px",
          "background-position": "-8px -8px"
        }}
      />
      
      {/* Floating money particles */}
      <For each={particles}>
        {(particle) => (
          <Motion.div
            animate={{ 
              y: [0, -15, 0],
              opacity: [0.4, 0.8, 0.4],
              scale: [0.8, 1, 0.8]
            }}
            transition={{ 
              duration: 3, 
              delay: particle.delay,
              repeat: Infinity,
              easing: 'ease-in-out'
            }}
            class="absolute bottom-8"
            style={{ left: `${particle.x}px` }}
          >
            <div class="relative">
              {/* Glow */}
              <div class="absolute inset-0 size-6 rounded-full bg-yellow-400 blur-md opacity-50" />
              {/* Particle */}
              <div class="relative size-6 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500" />
            </div>
          </Motion.div>
        )}
      </For>

      {/* Bottom label */}
      <Motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        class="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-500"
      >
        Watch your money work automatically
      </Motion.p>
    </div>
  );
};

export default MiniMoneyAnimation;

