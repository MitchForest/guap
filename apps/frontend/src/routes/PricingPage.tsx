import { useRouter } from '@tanstack/solid-router';
import { Component, For, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/components/ui/accordion';
import { AppPaths } from '~/routerPaths';
import BillingToggle from '~/components/pricing/BillingToggle';
import PricingCard from '~/components/pricing/PricingCard';

const PricingPage: Component = () => {
  const router = useRouter();
  const [isYearly, setIsYearly] = createSignal(true); // Default to yearly to show savings

  const plans = [
    {
      name: 'Individual Child',
      badge: 'Perfect for 1 kid',
      icon: '👨‍👩‍👧',
      monthlyPrice: 49,
      yearlyPrice: 490,
      description: 'Everything your family needs to teach one child financial literacy',
      features: [
        'Up to 2 parent/guardian accounts',
        '1 child/teen account',
        'Unlimited money map automation',
        'Smart allowance rules',
        'Goal tracking & savings challenges',
        'Real-time transaction approvals',
        'Financial education resources',
        'Mobile app access',
        'Bank-level security',
      ],
    },
    {
      name: 'Family Plan',
      badge: 'Best for growing families',
      icon: '👨‍👩‍👧‍👦',
      monthlyPrice: 79,
      yearlyPrice: 790,
      description: 'Complete family financial automation for up to 4 children',
      features: [
        'Up to 2 parent/guardian accounts',
        'Up to 4 child/teen accounts',
        'Unlimited money map automation',
        'Advanced multi-child rules',
        'Family goal tracking',
        'Household budgeting tools',
        'Real-time transaction approvals',
        'Priority customer support',
        'Financial education resources',
        'Mobile app access',
        'Bank-level security',
      ],
      isPopular: true,
    },
    {
      name: 'Schools & Programs',
      badge: 'Bulk seat pricing',
      icon: '🏫',
      monthlyPrice: 19,
      yearlyPrice: 190,
      description: 'Seat-based pricing for classrooms, districts, and youth programs.',
      features: [
        'Admin dashboard for rosters & seats',
        'Guardian + student co-invitations',
        'Bulk lesson plans & challenges',
        'Centralized billing & reporting',
        'Leaderboard and cohort insights',
        'Flexible seat transfers',
        'CSV import & SIS-ready exports',
      ],
      showCostPerDay: false,
      footnote: 'First 100 seats at $19/mo ($190/year). Additional seats $9/mo ($90/year).',
      ctaLabel: 'Set up organization',
    },
  ];

  const faqs = [
    {
      question: 'Can I switch plans later?',
      answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.",
    },
    {
      question: 'What happens if I cancel?',
      answer: 'You can cancel anytime with no fees or penalties. Your account remains active until the end of your billing period. We offer a 30-day money-back guarantee, no questions asked.',
    },
    {
      question: 'Do I need to connect a bank account?',
      answer: 'No! You can start planning and building your money map without connecting any accounts. Bank connections are optional and only needed when you want to automate real transfers.',
    },
    {
      question: 'Is there a free trial?',
      answer: "We offer a 30-day money-back guarantee instead of a limited trial. Try Guap with full access, and if it's not right for you, get a complete refund within 30 days.",
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, and ACH bank transfers. All payments are processed securely through Stripe.',
    },
  ];

  const handleSelectPlan = () => {
    // Navigate to sign-up with selected plan
    router.navigate({ to: AppPaths.signUp });
  };

  return (
    <div class="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header class="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <button
            type="button"
            class="flex items-center gap-2 text-lg font-bold text-slate-900"
            onClick={() => router.navigate({ to: AppPaths.landing })}
          >
            <span class="text-2xl">🪙</span>
            <span>Guap</span>
          </button>
          <div class="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              class="text-sm font-semibold"
              onClick={() => router.navigate({ to: AppPaths.signIn })}
            >
              Log in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section class="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20">
        <div class="text-center space-y-6">
          <h1 class="text-5xl font-bold text-slate-900 sm:text-6xl">
            Start free, upgrade when you're ready
          </h1>
          <p class="mx-auto max-w-2xl text-lg text-slate-600">
            Every student begins with a sandbox account. Add real money features with the plan that fits your family or organization.
          </p>

          {/* Billing Toggle */}
          <div class="pt-4">
            <BillingToggle isYearly={isYearly()} onToggle={setIsYearly} />
          </div>

          {/* Trust Badges */}
          <div class="flex flex-wrap items-center justify-center gap-6 pt-4">
            <div class="flex items-center gap-2 text-sm font-medium text-slate-600">
              <svg class="size-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Cancel anytime</span>
            </div>
            <div class="flex items-center gap-2 text-sm font-medium text-slate-600">
              <svg class="size-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>30-day money back guarantee</span>
            </div>
            <div class="flex items-center gap-2 text-sm font-medium text-slate-600">
              <svg class="size-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>No long-term commitment</span>
            </div>
          </div>
        </div>
      </section>

      {/* Limited-Time Offer Banner */}
      <section class="mx-auto w-full max-w-7xl px-6 pb-8">
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center shadow-lg">
          <div class="absolute inset-0 opacity-20">
            <div class="absolute right-0 top-0 h-32 w-32 rounded-full bg-white blur-3xl" />
            <div class="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white blur-3xl" />
          </div>
          <div class="relative">
            <p class="text-lg font-bold text-white">
              🎉 Launch Special: Get 16% off when you pay yearly!
            </p>
            <p class="mt-2 text-sm text-indigo-100">
              Join the first 1,000 families building wealth with Guap
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section class="mx-auto w-full max-w-7xl px-6 pb-20">
        <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <For each={plans}>
            {(plan) => (
              <PricingCard
                {...plan}
                isYearly={isYearly()}
                onSelect={handleSelectPlan}
              />
            )}
          </For>
        </div>
      </section>

      {/* Social Proof Section */}
      <section class="bg-slate-50 py-20">
        <div class="mx-auto w-full max-w-7xl px-6">
          <div class="text-center mb-12">
            <h2 class="text-3xl font-bold text-slate-900 sm:text-4xl">
              Trusted by hundreds of families
            </h2>
            <p class="mt-4 text-lg text-slate-600">
              See what parents and teens are saying about Guap
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-3">
            <div class="surface-panel p-6 space-y-4">
              <div class="flex gap-1">
                <For each={[1, 2, 3, 4, 5]}>
                  {() => <span class="text-yellow-400 text-xl">★</span>}
                </For>
              </div>
              <p class="text-sm text-slate-700">
                "Worth every penny! My daughter finally understands how money works, and I can see exactly where her allowance goes."
              </p>
              <div>
                <p class="font-semibold text-slate-900">Jennifer Martinez</p>
                <p class="text-xs text-slate-500">Parent, using for 6 months</p>
              </div>
            </div>

            <div class="surface-panel p-6 space-y-4">
              <div class="flex gap-1">
                <For each={[1, 2, 3, 4, 5]}>
                  {() => <span class="text-yellow-400 text-xl">★</span>}
                </For>
              </div>
              <p class="text-sm text-slate-700">
                "The automation is incredible. Set it up once, and allowances happen like clockwork. My kids are learning to save without me nagging!"
              </p>
              <div>
                <p class="font-semibold text-slate-900">David Chen</p>
                <p class="text-xs text-slate-500">Father of 3</p>
              </div>
            </div>

            <div class="surface-panel p-6 space-y-4">
              <div class="flex gap-1">
                <For each={[1, 2, 3, 4, 5]}>
                  {() => <span class="text-yellow-400 text-xl">★</span>}
                </For>
              </div>
              <p class="text-sm text-slate-700">
                "I can actually see my savings growing! The visual money map makes it so much easier to understand where my money goes."
              </p>
              <div>
                <p class="font-semibold text-slate-900">Alex (Age 15)</p>
                <p class="text-xs text-slate-500">Teen user</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Money-Back Guarantee Section */}
      <section class="bg-white py-20">
        <div class="mx-auto w-full max-w-4xl px-6 text-center">
          <div class="surface-panel p-12 space-y-6">
            <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <span class="text-4xl">✓</span>
            </div>
            <h2 class="text-3xl font-bold text-slate-900">
              30-Day Money-Back Guarantee
            </h2>
            <p class="text-lg text-slate-600 max-w-2xl mx-auto">
              We're confident Guap will transform your family's financial habits. If you're not completely satisfied within 30 days, we'll refund every penny—no questions asked.
            </p>
            <div class="flex flex-wrap justify-center gap-4 pt-4">
              <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg class="size-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span>No risk</span>
              </div>
              <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg class="size-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span>Full refund</span>
              </div>
              <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg class="size-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span>No questions asked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section class="bg-slate-50 py-20">
        <div class="mx-auto w-full max-w-5xl px-6">
          <div class="text-center mb-12">
            <h2 class="text-3xl font-bold text-slate-900">
              Compare plans
            </h2>
            <p class="mt-4 text-slate-600">
              All plans include our core features. Choose based on your family size.
            </p>
          </div>

          <div class="surface-panel overflow-hidden">
            <table class="w-full">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-slate-900">Feature</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-slate-900">Individual</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-slate-900">Family</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <For each={[
                  { feature: 'Parent/Guardian accounts', individual: '2', family: '2' },
                  { feature: 'Child/Teen accounts', individual: '1', family: '4' },
                  { feature: 'Money map automation', individual: '✓', family: '✓' },
                  { feature: 'Smart allowance rules', individual: '✓', family: '✓' },
                  { feature: 'Goal tracking', individual: '✓', family: '✓' },
                  { feature: 'Transaction approvals', individual: '✓', family: '✓' },
                  { feature: 'Mobile app access', individual: '✓', family: '✓' },
                  { feature: 'Priority support', individual: '—', family: '✓' },
                  { feature: 'Household budgeting', individual: '—', family: '✓' },
                ]}>
                  {(row) => (
                    <tr class="hover:bg-slate-50/50">
                      <td class="px-6 py-4 text-sm text-slate-700">{row.feature}</td>
                      <td class="px-6 py-4 text-center text-sm font-medium text-slate-900">{row.individual}</td>
                      <td class="px-6 py-4 text-center text-sm font-medium text-slate-900">{row.family}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section class="bg-white py-20">
        <div class="mx-auto w-full max-w-3xl px-6">
          <div class="text-center mb-12">
            <h2 class="text-3xl font-bold text-slate-900">
              Pricing questions
            </h2>
            <p class="mt-4 text-slate-600">
              Everything you need to know about our pricing and policies
            </p>
          </div>

          <Accordion collapsible defaultValue={['pricing-faq-0']} class="space-y-4">
            <For each={faqs}>
              {(faq, index) => (
                <AccordionItem value={`pricing-faq-${index()}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              )}
            </For>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section class="relative bg-slate-900 py-20 overflow-hidden">
        {/* Decorative background */}
        <div class="absolute inset-0 opacity-10">
          <div class="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-400 blur-3xl" />
          <div class="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-purple-400 blur-3xl" />
        </div>

        <div class="relative mx-auto w-full max-w-4xl px-6 text-center">
          <h2 class="text-3xl font-bold text-white sm:text-4xl">
            Ready to build lasting wealth habits?
          </h2>
          <p class="mt-4 text-lg text-slate-300">
            Join hundreds of families teaching their kids about money the right way
          </p>
          <div class="mt-8 flex flex-col items-center gap-4">
            <Button
              type="button"
              class="h-12 rounded-full bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
              onClick={() => router.navigate({ to: AppPaths.signUp })}
            >
              Get started now →
            </Button>
            <p class="text-sm text-slate-400">
              💡 30-day money-back guarantee • No credit card required to start
            </p>
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

export default PricingPage;
