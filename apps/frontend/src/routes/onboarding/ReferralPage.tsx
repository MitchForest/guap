import { useRouter } from '@tanstack/solid-router';
import { Component, createSignal, For } from 'solid-js';
import { Button } from '~/components/ui/button';
import { AppPaths } from '~/routerPaths';

const ReferralPage: Component = () => {
  const router = useRouter();
  const [selectedSources, setSelectedSources] = createSignal<string[]>([]);

  const sources = [
    'ChatGPT / Other AI',
    'Reddit',
    'Podcast',
    'LinkedIn',
    'Someone I Follow',
    'YouTube',
    'Google',
    'Facebook Ad',
    'Instagram Ad',
    'X (Twitter)',
    'TikTok',
    'Friend / Colleague',
    'Other',
  ];

  const toggleSource = (source: string) => {
    const current = selectedSources();
    if (current.includes(source)) {
      setSelectedSources(current.filter((s) => s !== source));
    } else {
      setSelectedSources([...current, source]);
    }
  };

  const handleContinue = () => {
    if (selectedSources().length > 0) {
      router.navigate({ to: AppPaths.app });
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
            <div class="h-full w-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500" />
          </div>

          {/* Card */}
          <div class="rounded-3xl border border-slate-200/80 bg-white p-10 shadow-xl">
            <div class="space-y-8">
              <h1 class="text-3xl font-bold text-slate-900">How did you hear about us?</h1>

              <div class="flex flex-wrap gap-3">
                <For each={sources}>
                  {(source) => (
                    <button
                      type="button"
                      class="rounded-full border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      classList={{
                        'border-indigo-600 bg-indigo-600 text-white hover:border-indigo-700 hover:bg-indigo-700':
                          selectedSources().includes(source),
                      }}
                      onClick={() => toggleSource(source)}
                    >
                      {source}
                    </button>
                  )}
                </For>
              </div>

              <div class="flex justify-end">
                <Button
                  type="button"
                  class="h-12 rounded-2xl bg-indigo-600 px-8 text-base font-semibold text-white hover:bg-indigo-700"
                  disabled={selectedSources().length === 0}
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

export default ReferralPage;

