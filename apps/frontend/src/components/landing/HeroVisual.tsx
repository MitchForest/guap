import { Component } from 'solid-js';

const HeroVisual: Component = () => {
  return (
    <div class="relative w-full max-w-lg">
      {/* Main container with elevated surface */}
      <div class="surface-panel relative aspect-square overflow-hidden p-8">
        {/* Dot grid background */}
        <div
          class="absolute inset-0 opacity-40"
          style={{
            'background-image': 'radial-gradient(#94a3b8 1px, transparent 0)',
            'background-size': '20px 20px',
            'background-position': '-10px -10px',
          }}
        />
        
        {/* Central flow illustration */}
        <div class="relative z-10 flex h-full flex-col items-center justify-center gap-8">
          {/* Income node at top */}
          <div class="flex flex-col items-center gap-2 animate-fade-in">
            <div class="flex h-20 w-48 items-center justify-center gap-3 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 px-4 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1">
              <span class="text-3xl">💰</span>
              <div>
                <p class="text-sm font-semibold text-blue-900">Monthly Income</p>
                <p class="text-xs text-blue-600">$5,000/mo</p>
              </div>
            </div>
            {/* Arrow */}
            <div class="flex flex-col items-center animate-pulse">
              <div class="h-8 w-0.5 bg-gradient-to-b from-blue-300 to-transparent" />
              <svg class="h-3 w-3 text-blue-300" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 12L0 6h12z" />
              </svg>
            </div>
          </div>

          {/* Distribution nodes */}
          <div class="grid grid-cols-3 gap-3">
            {/* Checking */}
            <div
              class="flex flex-col items-center gap-1 animate-fade-in"
              style={{ 'animation-delay': '150ms' }}
            >
              <div class="flex h-16 w-20 flex-col items-center justify-center rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-2 shadow-md transition-all hover:shadow-lg hover:-translate-y-1">
                <span class="text-xl">🏦</span>
                <p class="text-[10px] font-semibold text-indigo-900">Checking</p>
              </div>
              <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">60%</span>
            </div>

            {/* Savings */}
            <div
              class="flex flex-col items-center gap-1 animate-fade-in"
              style={{ 'animation-delay': '300ms' }}
            >
              <div class="flex h-16 w-20 flex-col items-center justify-center rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-2 shadow-md transition-all hover:shadow-lg hover:-translate-y-1">
                <span class="text-xl">🪙</span>
                <p class="text-[10px] font-semibold text-orange-900">Savings</p>
              </div>
              <span class="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">30%</span>
            </div>

            {/* Investing */}
            <div
              class="flex flex-col items-center gap-1 animate-fade-in"
              style={{ 'animation-delay': '450ms' }}
            >
              <div class="flex h-16 w-20 flex-col items-center justify-center rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-2 shadow-md transition-all hover:shadow-lg hover:-translate-y-1">
                <span class="text-xl">📈</span>
                <p class="text-[10px] font-semibold text-green-900">Investing</p>
              </div>
              <span class="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">10%</span>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div class="absolute right-4 top-4 h-16 w-16 rounded-full bg-blue-100/50 blur-2xl" />
        <div class="absolute bottom-4 left-4 h-20 w-20 rounded-full bg-orange-100/50 blur-2xl" />
      </div>
    </div>
  );
};

export default HeroVisual;
