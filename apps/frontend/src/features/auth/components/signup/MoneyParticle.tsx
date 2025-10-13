import { Component } from 'solid-js';
import { Motion } from 'solid-motionone';

type MoneyParticleProps = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  onComplete?: () => void;
};

const MoneyParticle: Component<MoneyParticleProps> = (props) => {
  const midX = props.startX;
  const midY = (props.startY + props.endY) / 2;

  return (
    <Motion.div
      initial={{ x: props.startX, y: props.startY, opacity: 0, scale: 0 }}
      animate={{ 
        x: [props.startX, midX, props.endX],
        y: [props.startY, midY, props.endY],
        opacity: [0, 1, 1, 0],
        scale: [0, 1, 1, 0]
      }}
      transition={{ 
        duration: props.duration,
        delay: props.delay,
        easing: [0.22, 1, 0.36, 1],
      }}
      onMotionComplete={() => props.onComplete?.()}
      class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ "z-index": 10 }}
    >
      {/* Coin/particle */}
      <div class="relative">
        {/* Glow effect */}
        <div class="absolute inset-0 size-3 rounded-full bg-yellow-400 blur-md opacity-75" />
        {/* Solid particle */}
        <div class="relative size-3 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg" />
      </div>
    </Motion.div>
  );
};

export default MoneyParticle;

