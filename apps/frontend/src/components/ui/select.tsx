import type { Component, JSX, ValidComponent } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import * as SelectPrimitive from '@kobalte/core/select';
import type { SelectRootItemComponentProps } from '@kobalte/core/select';
import { cva } from 'class-variance-authority';
import { cn } from '~/lib/utils';

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  hint?: string;
  icon?: JSX.Element | string;
  disabled?: boolean;
};

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;
const SelectHiddenSelect = SelectPrimitive.HiddenSelect;

type SelectTriggerProps<T extends ValidComponent = 'button'> =
  SelectPrimitive.SelectTriggerProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const SelectTrigger = <T extends ValidComponent = 'button'>(props: SelectTriggerProps<T>) => {
  const [local, others] = splitProps(props as SelectTriggerProps, ['class', 'children']);
  return (
    <SelectPrimitive.Trigger
      class={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 disabled:cursor-not-allowed disabled:opacity-50',
        local.class
      )}
      {...others}
    >
      <span class="flex min-w-0 flex-1 items-center gap-2 truncate text-left">{local.children}</span>
      <SelectPrimitive.Icon class="ml-1 flex items-center text-slate-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
        >
          <path d="M8 9l4-4 4 4" />
          <path d="M16 15l-4 4-4-4" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
};

type SelectContentProps<T extends ValidComponent = 'div'> = SelectPrimitive.SelectContentProps<T> & {
  class?: string;
};

const SelectContent = <T extends ValidComponent = 'div'>(props: SelectContentProps<T>) => {
  const [local, others] = splitProps(props as SelectContentProps, ['class']);
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        class={cn(
          'z-50 min-w-[12rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-floating data-[expanded]:animate-in data-[closed]:animate-out',
          local.class
        )}
        {...others}
      >
        <SelectPrimitive.Listbox class="m-0 grid gap-1 p-1" />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
};

type SelectItemComponentProps = SelectRootItemComponentProps<SelectOption>;

const SelectItem: Component<SelectItemComponentProps> = (props) => {
  const option = () => props.item.rawValue as SelectOption;
  const icon = () => option().icon;
  const description = () => option().description ?? option().hint;
  const isDisabled = () => option().disabled ?? false;

  return (
    <SelectPrimitive.Item
      item={props.item}
      class="relative flex cursor-default select-none items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      classList={{ 'pointer-events-none opacity-50': isDisabled() }}
    >
      <SelectPrimitive.ItemIndicator class="absolute right-3 flex size-4 items-center justify-center text-slate-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M5 12l5 5l10-10" />
        </svg>
      </SelectPrimitive.ItemIndicator>
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <Show when={icon()}>
          {(content) => <span class="text-base leading-none text-slate-500">{content()}</span>}
        </Show>
        <div class="min-w-0 flex-1">
          <SelectPrimitive.ItemLabel class="block truncate font-medium">{option().label}</SelectPrimitive.ItemLabel>
          <Show when={description()}>
            {(text) => <span class="block truncate text-xs text-slate-500">{text()}</span>}
          </Show>
        </div>
      </div>
    </SelectPrimitive.Item>
  );
};

const labelVariants = cva(
  'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
  {
    variants: {
      tone: {
        label: 'text-slate-500',
        description: 'text-subtle font-normal normal-case tracking-normal',
        error: 'text-rose-600 normal-case tracking-normal',
      },
    },
    defaultVariants: {
      tone: 'label',
    },
  }
);

type SelectLabelProps<T extends ValidComponent = 'label'> = SelectPrimitive.SelectLabelProps<T> & {
  class?: string;
};

const SelectLabel = <T extends ValidComponent = 'label'>(props: SelectLabelProps<T>) => {
  const [local, others] = splitProps(props as SelectLabelProps, ['class']);
  return <SelectPrimitive.Label class={cn(labelVariants(), local.class)} {...others} />;
};

type SelectDescriptionProps<T extends ValidComponent = 'div'> =
  SelectPrimitive.SelectDescriptionProps<T> & {
    class?: string;
  };

const SelectDescription = <T extends ValidComponent = 'div'>(props: SelectDescriptionProps<T>) => {
  const [local, others] = splitProps(props as SelectDescriptionProps, ['class']);
  return (
    <SelectPrimitive.Description class={cn(labelVariants({ tone: 'description' }), local.class)} {...others} />
  );
};

type SelectErrorMessageProps<T extends ValidComponent = 'div'> =
  SelectPrimitive.SelectErrorMessageProps<T> & {
    class?: string;
  };

const SelectErrorMessage = <T extends ValidComponent = 'div'>(
  props: SelectErrorMessageProps<T>
) => {
  const [local, others] = splitProps(props as SelectErrorMessageProps, ['class']);
  return (
    <SelectPrimitive.ErrorMessage class={cn(labelVariants({ tone: 'error' }), local.class)} {...others} />
  );
};

export type { SelectOption };
export {
  Select,
  SelectValue,
  SelectHiddenSelect,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectDescription,
  SelectErrorMessage,
};
