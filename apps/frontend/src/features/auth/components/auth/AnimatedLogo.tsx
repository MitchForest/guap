import { Component } from 'solid-js';

const AnimatedLogo: Component = () => {
  return (
    <div class="flex justify-center">
      <div class="flex items-center gap-2 text-xl font-bold text-slate-900 animate-pulse">
        <span class="text-3xl">🪙</span>
        <span>Guap</span>
      </div>
    </div>
  );
};

export default AnimatedLogo;

