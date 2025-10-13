import type { JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as AccordionPrimitive from '@kobalte/core/accordion';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import { cn } from '~/shared/utils/classnames';

const Accordion = AccordionPrimitive.Root;

type AccordionItemProps<T extends ValidComponent = 'div'> = AccordionPrimitive.AccordionItemProps<T> & {
  class?: string;
};

const AccordionItem = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, AccordionItemProps<T>>
) => {
  const [local, others] = splitProps(props as AccordionItemProps, ['class']);
  return (
    <AccordionPrimitive.Item
      class={cn('surface-panel overflow-hidden', local.class)}
      {...others}
    />
  );
};

type AccordionTriggerProps<T extends ValidComponent = 'button'> =
  AccordionPrimitive.AccordionTriggerProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const AccordionTrigger = <T extends ValidComponent = 'button'>(
  props: PolymorphicProps<T, AccordionTriggerProps<T>>
) => {
  const [local, others] = splitProps(props as AccordionTriggerProps, ['class', 'children']);
  return (
    <AccordionPrimitive.Header class="flex">
      <AccordionPrimitive.Trigger
        class={cn(
          'flex flex-1 items-center justify-between px-6 py-4 text-left text-lg font-semibold text-slate-900 transition-all hover:bg-slate-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300',
          local.class
        )}
        {...others}
      >
        {local.children}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-5 shrink-0 text-slate-500 transition-transform duration-200 data-[expanded]:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
};

type AccordionContentProps<T extends ValidComponent = 'div'> =
  AccordionPrimitive.AccordionContentProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const AccordionContent = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, AccordionContentProps<T>>
) => {
  const [local, others] = splitProps(props as AccordionContentProps, ['class', 'children']);
  return (
    <AccordionPrimitive.Content
      class={cn(
        'overflow-hidden border-t border-slate-100 data-[expanded]:animate-accordion-down data-[closed]:animate-accordion-up',
        local.class
      )}
      {...others}
    >
      <div class="px-6 py-4 text-slate-600">{local.children}</div>
    </AccordionPrimitive.Content>
  );
};

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };

