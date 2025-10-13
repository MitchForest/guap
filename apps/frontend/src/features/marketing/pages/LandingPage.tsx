import { useRouter } from '@tanstack/solid-router';
import { Component, For } from 'solid-js';
import { Button } from '~/shared/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/shared/components/ui/accordion';
import { useAuth } from '~/app/contexts/AuthContext';
import { AppPaths } from '~/app/routerPaths';
import HeroVisual from '~/features/marketing/components/landing/HeroVisual';
import MoneyFlowDiagram from '~/features/marketing/components/landing/MoneyFlowDiagram';
import TestimonialCard from '~/features/marketing/components/landing/TestimonialCard';

const LandingPage: Component = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      title: 'Visualize your family cashflow',
      description:
        'See exactly where every dollar flows. Track income, expenses, savings, and goals in a beautiful money map that the whole family can understand.',
      points: [
        'Live money flow visualization',
        'Shared dashboards for parents and teens',
        'Track every dollar with purpose',
      ],
    },
    {
      title: 'Smart allowance automation',
      description:
        'Set up rules once, watch them run forever. Automate allowances, savings targets, and spending limits with transparent approvals every step of the way.',
      points: [
        'Automatic allowance distribution',
        'Parent approval workflows',
        'Smart spend and save rules',
      ],
    },
    {
      title: 'Build real wealth habits',
      description:
        'Go beyond tracking. Help teens learn to earn, save, invest, spend responsibly, and give back—all within a safe, parent-supervised environment.',
      points: [
        'Age-appropriate financial education',
        'Real investment opportunities',
        'Goal-based saving challenges',
      ],
    },
  ];

  const faqs = [
    {
      question: 'Is Guap safe for my teen?',
      answer:
        'Absolutely. Parents maintain full oversight and approval rights for all transactions and account activities.',
    },
    {
      question: 'How does Guap work?',
      answer:
        'Guap connects your family accounts and creates automated money flows. You set the rules, and Guap handles the routing, tracking, and reporting.',
    },
    {
      question: 'Do I need a bank account?',
      answer:
        'You can start planning your money map without connecting any accounts. When ready, connect bank accounts to automate real transfers.',
    },
    {
      question: 'Can I manage my own finances too?',
      answer:
        'Yes! Guap works for individual adults, parents, and whole households. Start with your own finances or add family members anytime.',
    },
  ];

  return (
    <div class="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 via-indigo-50/30 to-white">
      {/* Header */}
      <header class="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div class="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span class="text-2xl">🪙</span>
            <span>Guap</span>
          </div>
          <div class="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              class="text-sm font-semibold"
              onClick={() => router.navigate({ to: isAuthenticated() ? AppPaths.app : AppPaths.signIn })}
            >
              {isAuthenticated() ? 'Open App' : 'Log in'}
            </Button>
            <Button
              type="button"
              class="rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => router.navigate({ to: isAuthenticated() ? AppPaths.app : AppPaths.signUp })}
            >
              {isAuthenticated() ? 'Go to Dashboard' : 'Get started'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section class="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32">
        <div class="grid items-center gap-12 lg:grid-cols-2">
          {/* Left column - Text */}
          <div>
            <h1 class="text-5xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Taxes, Expenses, Paychecks{' '}
              <span class="relative inline-block">
                <span class="text-slate-600">—automated</span>
                <span class="ml-2 inline-block">✨</span>
              </span>
            </h1>
            <p class="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Guap helps families route every dollar with intent. Earn, save, invest, spend, and
              donate—guided by smart automations and transparent approvals.
            </p>
            <div class="mt-10 flex flex-wrap items-start gap-4">
              <Button
                type="button"
                class="h-12 rounded-full bg-slate-900 px-8 text-base font-semibold text-white hover:bg-slate-800"
                onClick={() =>
                  router.navigate({ to: isAuthenticated() ? AppPaths.app : AppPaths.signUp })
                }
              >
                Get started →
              </Button>
              <p class="mt-3 text-sm text-slate-500">No credit card required</p>
            </div>
          </div>

          {/* Right column - Visual */}
          <div class="flex items-center justify-center">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section class="mx-auto w-full max-w-7xl px-6 py-16">
        <div class="text-center">
          <p class="text-sm font-medium uppercase tracking-wider text-slate-500">
            Trusted by families building wealth together
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-8 opacity-40 grayscale">
            <div class="flex items-center gap-2 text-2xl font-bold text-slate-700">
              <span>🔒</span>
              <span class="text-base">Bank-level security</span>
            </div>
            <div class="flex items-center gap-2 text-2xl font-bold text-slate-700">
              <span>🏦</span>
              <span class="text-base">FDIC insured</span>
            </div>
            <div class="flex items-center gap-2 text-2xl font-bold text-slate-700">
              <span>✅</span>
              <span class="text-base">Parent approved</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section class="bg-white py-24">
        <div class="mx-auto w-full max-w-7xl px-6">
          <div class="text-center">
            <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why families love Guap
            </h2>
          </div>
          <div class="mt-20 space-y-32">
            <For each={features}>
              {(feature, index) => (
                <div
                  class="grid items-center gap-16 lg:grid-cols-2"
                  classList={{
                    'lg:[&>*:first-child]:order-2': index() % 2 === 1,
                  }}
                >
                  <div>
                    <h3 class="text-3xl font-bold tracking-tight text-slate-900">
                      {feature.title}
                    </h3>
                    <p class="mt-4 text-lg leading-relaxed text-slate-600">
                      {feature.description}
                    </p>
                    <ul class="mt-8 space-y-3">
                      <For each={feature.points}>
                        {(point) => (
                          <li class="flex items-start gap-3 text-slate-700">
                            <svg
                              class="mt-1 size-5 shrink-0 text-green-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{point}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                    <div class="mt-8">
                      <Button
                        type="button"
                        variant="outline"
                        class="rounded-full"
                        onClick={() => router.navigate({ to: AppPaths.signUp })}
                      >
                        Get started →
                      </Button>
                    </div>
                  </div>
                  <div class="flex items-center justify-center">
                    {index() === 0 ? (
                      <div class="w-full max-w-md">
                        <MoneyFlowDiagram />
                      </div>
                    ) : (
                      <div class="surface-panel aspect-square w-full max-w-md bg-gradient-to-br from-blue-50 to-indigo-100 p-12">
                        <div class="flex h-full items-center justify-center">
                          <div class="text-center">
                            <span class="text-6xl">
                              {index() === 1 ? '⚡' : '🎯'}
                            </span>
                            <p class="mt-4 text-sm font-medium text-slate-600">
                              {feature.title}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section class="bg-slate-50 py-24">
        <div class="mx-auto w-full max-w-7xl px-6">
          <div class="text-center">
            <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              What families have to say
            </h2>
            <p class="mt-4 text-slate-600">
              Real stories from families building wealth together
            </p>
          </div>
          <div class="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <TestimonialCard
              quote="Guap transformed how we teach our kids about money. Now they understand where every dollar goes and why saving matters."
              author="Sarah Chen"
              role="Parent of 2 teens"
              avatar="👩‍💼"
            />
            <TestimonialCard
              quote="Finally, an allowance system that actually works! My son can see his savings grow toward his goals, and I can approve everything."
              author="Marcus Johnson"
              role="Father & Financial Advisor"
              avatar="👨‍💻"
            />
            <TestimonialCard
              quote="The visual money map makes family finance discussions so much easier. Everyone understands the flow now."
              author="Emily Rodriguez"
              role="Mom of 3"
              avatar="👩‍👧‍👦"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section class="bg-white py-24">
        <div class="mx-auto w-full max-w-3xl px-6">
          <h2 class="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Frequently asked questions
          </h2>
          <p class="mt-4 text-center text-slate-600">
            Everything you need to know about Guap and how to get started
          </p>
          <div class="mt-12">
            <Accordion collapsible defaultValue={['faq-0']} class="space-y-4">
              <For each={faqs}>
                {(faq, index) => (
                  <AccordionItem value={`faq-${index()}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                )}
              </For>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section class="relative bg-slate-900 py-24 overflow-hidden">
        {/* Decorative background elements */}
        <div class="absolute inset-0 opacity-10">
          <div class="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-400 blur-3xl" />
          <div class="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-indigo-400 blur-3xl" />
        </div>
        
        <div class="relative mx-auto w-full max-w-4xl px-6 text-center">
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Get total control of your family finances
          </h2>
          <p class="mt-4 text-lg text-slate-300">
            Start building wealth habits that last a lifetime
          </p>
          <div class="mt-10 flex flex-col items-center gap-4">
            <Button
              type="button"
              class="h-12 rounded-full bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
              onClick={() => router.navigate({ to: AppPaths.signUp })}
            >
              Get started →
            </Button>
            <p class="text-sm text-slate-400">Join hundreds of families building wealth together</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-t border-slate-200 bg-white py-12">
        <div class="mx-auto w-full max-w-7xl px-6">
          <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div class="flex items-center gap-2 text-lg font-bold text-slate-900">
              <span class="text-2xl">🪙</span>
              <span>Guap</span>
            </div>
            <p class="text-sm text-slate-500">
              © {new Date().getFullYear()} Guap. Building wealth habits for families.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
