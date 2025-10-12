import { Component, For, createSignal, onMount } from 'solid-js';

const EmailJourneyAnimation: Component = () => {
  const [step, setStep] = createSignal(0);

  onMount(() => {
    const timers = [
      setTimeout(() => setStep(1), 1000),   // Show link traveling
      setTimeout(() => setStep(2), 2500),   // Show browser
      setTimeout(() => setStep(3), 3500),   // Show celebration
    ];
    return () => timers.forEach(clearTimeout);
  });

  return (
    <div class="relative flex h-96 w-full max-w-lg items-center justify-center p-8">
      {/* Envelope */}
      <div class="absolute left-20 top-1/2 -translate-y-1/2 animate-fade-in">
        <div class="relative">
          {/* Envelope body */}
          <div class="relative size-24 rounded-lg bg-white border-4 border-slate-300 shadow-lg flex items-center justify-center">
            <span class="text-4xl">📧</span>
          </div>
          {/* Glow effect */}
          <div class="absolute inset-0 rounded-lg bg-blue-400/20 blur-xl -z-10 animate-pulse" />
        </div>
      </div>

      {/* Magic link traveling */}
      {step() >= 1 && (
        <div 
          class="absolute left-28 top-1/2 -translate-y-1/2 transition-all duration-[2000ms] ease-out animate-fade-in"
          style={{ transform: `translate(${step() >= 2 ? '300px' : '0'}, -50%)` }}
        >
          <div class="relative">
            {/* Link sparkle */}
            <div class="size-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg">
              <span class="text-2xl">🔗</span>
            </div>
            {/* Trailing glow */}
            <div class="absolute inset-0 rounded-full bg-purple-400 blur-lg animate-pulse opacity-60" />
          </div>
        </div>
      )}

      {/* Browser icon */}
      {step() >= 2 && (
        <div class="absolute right-20 top-1/2 -translate-y-1/2 animate-fade-in">
          <div class="relative size-24 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg flex items-center justify-center">
            <span class="text-4xl">🌐</span>
          </div>
          {/* Glow when celebration */}
          {step() >= 3 && (
            <div class="absolute inset-0 rounded-xl bg-purple-400/30 blur-xl -z-10 animate-pulse" />
          )}
        </div>
      )}

      {/* Celebration particles */}
      {step() >= 3 && (
        <For each={[0, 45, 90, 135, 180, 225, 270, 315]}>
          {(angle, i) => {
            const radian = (angle * Math.PI) / 180;
            const distance = 60;
            const endX = Math.cos(radian) * distance;
            const endY = Math.sin(radian) * distance;
            
            return (
              <div 
                class="absolute right-20 top-1/2 -translate-y-1/2 animate-ping"
                style={{
                  "animation-delay": `${i() * 0.05}s`,
                  "animation-duration": "1.5s"
                }}
              >
                <div 
                  class="size-2 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500"
                  style={{ transform: `translate(${endX}px, ${endY}px)` }}
                />
              </div>
            );
          }}
        </For>
      )}

      {/* Success checkmark */}
      {step() >= 3 && (
        <div class="absolute right-[4.5rem] top-[calc(50%-2.5rem)] animate-fade-in">
          <div class="size-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <svg class="size-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Instructions below */}
      <div class="absolute bottom-0 left-0 right-0 text-center space-y-1">
        <p class="text-sm font-medium text-slate-700">Click the link in your email to continue</p>
        <p class="text-xs text-slate-500">The link will expire in 15 minutes</p>
      </div>
    </div>
  );
};

export default EmailJourneyAnimation;
