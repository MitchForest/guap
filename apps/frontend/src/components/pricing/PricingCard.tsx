import { Component, For, Show } from 'solid-js';
import { Button } from '~/components/ui/button';

type PricingCardProps = {
  name: string;
  badge?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isYearly: boolean;
  description: string;
  features: string[];
  isPopular?: boolean;
  onSelect: () => void;
  icon: string;
  footnote?: string;
  ctaLabel?: string;
  showCostPerDay?: boolean;
};

const PricingCard: Component<PricingCardProps> = (props) => {
  const price = () => (props.isYearly ? props.yearlyPrice : props.monthlyPrice);
  const monthlyCost = () => (props.isYearly ? props.yearlyPrice / 12 : props.monthlyPrice);
  const savingsPercent = () => Math.round((1 - props.yearlyPrice / (props.monthlyPrice * 12)) * 100);
  const costPerDay = () => (monthlyCost() / 30).toFixed(2);

  return (
    <div
      class="relative flex flex-col rounded-3xl border-2 bg-white p-8 shadow-lg transition-all duration-300"
      classList={{
        'border-slate-900 shadow-xl scale-105': props.isPopular,
        'border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1': !props.isPopular,
      }}
    >
      {/* Popular badge */}
      <Show when={props.isPopular}>
        <div class="absolute -top-4 left-1/2 -translate-x-1/2">
          <div class="rounded-full bg-slate-900 px-4 py-1 text-sm font-bold text-white shadow-lg">
            ⭐ Most Popular
          </div>
        </div>
      </Show>

      {/* Header */}
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-3xl">{props.icon}</span>
          <div>
            <h3 class="text-2xl font-bold text-slate-900">{props.name}</h3>
            <Show when={props.badge}>
              <span class="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 uppercase">
                {props.badge}
              </span>
            </Show>
          </div>
        </div>
        <p class="text-sm text-slate-600">{props.description}</p>
      </div>

      {/* Pricing */}
      <div class="my-8 space-y-2">
        <div class="flex items-baseline gap-2">
          <span class="text-5xl font-bold text-slate-900">
            ${monthlyCost().toFixed(0)}
          </span>
          <span class="text-lg text-slate-600">/month</span>
        </div>
        <Show when={props.isYearly}>
          <p class="text-sm text-green-600 font-semibold">
            💰 Save {savingsPercent()}% with yearly billing (${price()}/year)
          </p>
        </Show>
        <Show when={!props.isYearly}>
          <p class="text-sm text-slate-500">
            or ${props.yearlyPrice}/year (save {savingsPercent()}%)
          </p>
        </Show>
        <Show
          when={props.showCostPerDay ?? true}
          fallback={
            props.footnote ? (
              <p class="text-xs text-slate-500">{props.footnote}</p>
            ) : null
          }
        >
          <p class="text-xs text-slate-500">Just ${costPerDay()}/day per family</p>
        </Show>
      </div>

      {/* CTA Button */}
      <Button
        type="button"
        onClick={props.onSelect}
        class="h-12 w-full rounded-2xl text-base font-semibold transition-all"
        classList={{
          'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-lg': props.isPopular,
          'bg-white text-slate-900 border-2 border-slate-900 hover:bg-slate-900 hover:text-white': !props.isPopular,
        }}
      >
        {props.ctaLabel ?? 'Get started →'}
      </Button>

      {/* Features */}
      <div class="mt-8 space-y-4">
        <p class="text-sm font-semibold text-slate-900">Plan includes:</p>
        <ul class="space-y-3">
          <For each={props.features}>
            {(feature) => (
              <li class="flex items-start gap-3 text-sm text-slate-700">
                <svg
                  class="mt-0.5 size-5 shrink-0 text-green-500"
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
                <span>{feature}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
};

export default PricingCard;
