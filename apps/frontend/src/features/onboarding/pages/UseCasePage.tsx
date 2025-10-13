import { useRouter } from '@tanstack/solid-router';
import { Component, createSignal, For } from 'solid-js';
import { Button } from '~/shared/components/ui/button';

const UseCasePage: Component = () => {
  const router = useRouter();
  const [selectedUseCase, setSelectedUseCase] = createSignal<string | null>(null);

  const useCases = [
    {
      id: 'business',
      label: 'Primarily for my business',
      icon: () => (
        <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'personal',
      label: 'Primarily for my personal finance',
      icon: () => (
        <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'both',
      label: 'Both for my business and personal finance',
      icon: () => (
        <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  const handleContinue = () => {
    if (selectedUseCase()) {
      router.navigate({ to: '/onboarding/referral' });
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
            <div class="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500" />
          </div>

          {/* Card */}
          <div class="rounded-3xl border border-slate-200/80 bg-white p-10 shadow-xl">
            <div class="space-y-8">
              <h1 class="text-3xl font-bold text-slate-900">
                What do you want to use Guap for?
              </h1>

              <div class="space-y-4">
                <For each={useCases}>
                  {(useCase) => (
                    <button
                      type="button"
                      class="flex w-full items-center gap-5 rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:bg-slate-50"
                      classList={{
                        'border-indigo-600 bg-indigo-50 hover:border-indigo-600 hover:bg-indigo-50':
                          selectedUseCase() === useCase.id,
                      }}
                      onClick={() => setSelectedUseCase(useCase.id)}
                    >
                      <div class="flex items-center justify-center text-slate-700">
                        {useCase.icon()}
                      </div>
                      <div class="flex-1">
                        <p class="text-base font-medium text-slate-900">{useCase.label}</p>
                      </div>
                    </button>
                  )}
                </For>
              </div>

              <div class="flex justify-end">
                <Button
                  type="button"
                  class="h-12 rounded-2xl bg-indigo-600 px-8 text-base font-semibold text-white hover:bg-indigo-700"
                  disabled={!selectedUseCase()}
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

export default UseCasePage;

