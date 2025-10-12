import { useRouter } from '@tanstack/solid-router';
import { Component, createSignal, For } from 'solid-js';
import { Button } from '~/components/ui/button';

const GoalSelectionPage: Component = () => {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = createSignal<string | null>(null);

  const goals = [
    { id: 'debt', label: 'Pay off debt' },
    { id: 'savings', label: 'Automatically maximize my savings' },
    { id: 'visualize', label: 'Visualize and track my finances' },
    { id: 'cashflow', label: 'Optimize my cash flow' },
    { id: 'taxes', label: 'Save for taxes' },
  ];

  const handleContinue = () => {
    if (selectedGoal()) {
      router.navigate({ to: '/onboarding/use-case' });
    }
  };

  return (
    <div class="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/40 to-purple-50/30">
      {/* Header */}
      <header class="fixed left-0 right-0 top-0 z-50 bg-white/80 backdrop-blur-sm">
        <div class="flex items-center justify-between px-8 py-4">
          <div class="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span class="text-2xl">🪙</span>
            <span>Guap</span>
          </div>
        </div>
      </header>

      <div class="mx-auto flex w-full max-w-3xl items-center justify-center px-8 pt-32">
        <div class="w-full">
          {/* Progress Bar */}
          <div class="mb-10 h-2 w-full overflow-hidden rounded-full bg-slate-200/60">
            <div class="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500" />
          </div>

          {/* Card */}
          <div class="rounded-3xl border border-slate-200/80 bg-white p-10 shadow-xl">
            <div class="space-y-8">
              <h1 class="text-3xl font-bold text-slate-900">
                What is your main goal with Guap?
              </h1>

              <div class="space-y-4">
                <For each={goals}>
                  {(goal) => (
                    <button
                      type="button"
                      class="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left text-base font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                      classList={{
                        'border-indigo-600 bg-indigo-50 hover:border-indigo-600 hover:bg-indigo-50':
                          selectedGoal() === goal.id,
                      }}
                      onClick={() => setSelectedGoal(goal.id)}
                    >
                      <div
                        class="flex size-6 items-center justify-center rounded-full border-2"
                        classList={{
                          'border-slate-300 bg-white': selectedGoal() !== goal.id,
                          'border-indigo-600 bg-indigo-600': selectedGoal() === goal.id,
                        }}
                      >
                        {selectedGoal() === goal.id && (
                          <div class="size-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span>{goal.label}</span>
                    </button>
                  )}
                </For>
              </div>

              <div class="flex justify-end">
                <Button
                  type="button"
                  class="h-12 rounded-2xl bg-indigo-600 px-8 text-base font-semibold text-white hover:bg-indigo-700"
                  disabled={!selectedGoal()}
                  onClick={handleContinue}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalSelectionPage;

