import type { Component, ComponentProps, JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as DropdownMenuPrimitive from '@kobalte/core/dropdown-menu';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import { cn } from '~/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

type DropdownMenuContentProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuContentProps<T> & {
    class?: string;
  };

const DropdownMenuContent = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DropdownMenuContentProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuContentProps, ['class']);
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        class={cn(
          'z-50 min-w-[12rem] origin-[var(--kb-menu-content-transform-origin)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-floating data-[expanded]:animate-in data-[closed]:animate-out',
          local.class
        )}
        {...others}
      />
    </DropdownMenuPrimitive.Portal>
  );
};

type DropdownMenuItemProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuItemProps<T> & {
    class?: string;
  };

const DropdownMenuItem = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, DropdownMenuItemProps<T>>) => {
  const [local, others] = splitProps(props as DropdownMenuItemProps, ['class']);
  return (
    <DropdownMenuPrimitive.Item
      class={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        local.class
      )}
      {...others}
    />
  );
};

const DropdownMenuShortcut: Component<ComponentProps<'span'>> = (props) => {
  const [local, others] = splitProps(props, ['class']);
  return <span class={cn('ml-auto text-xs uppercase tracking-[0.18em] text-slate-400', local.class)} {...others} />;
};

const DropdownMenuLabel: Component<ComponentProps<'div'> & { inset?: boolean }> = (props) => {
  const [local, others] = splitProps(props, ['class', 'inset']);
  return (
    <div
      class={cn('px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500', local.inset && 'pl-9', local.class)}
      {...others}
    />
  );
};

type DropdownMenuSeparatorProps<T extends ValidComponent = 'hr'> =
  DropdownMenuPrimitive.DropdownMenuSeparatorProps<T> & {
    class?: string;
  };

const DropdownMenuSeparator = <T extends ValidComponent = 'hr'>(
  props: PolymorphicProps<T, DropdownMenuSeparatorProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuSeparatorProps, ['class']);
  return (
    <DropdownMenuPrimitive.Separator
      class={cn('-mx-2 my-1 h-px bg-slate-200/80', local.class)}
      {...others}
    />
  );
};

type DropdownMenuSubTriggerProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuSubTriggerProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const DropdownMenuSubTrigger = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DropdownMenuSubTriggerProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuSubTriggerProps, ['class', 'children']);
  return (
    <DropdownMenuPrimitive.SubTrigger
      class={cn(
        'flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition focus:bg-slate-100 focus:text-slate-900 data-[state=open]:bg-slate-100',
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
        class="ml-auto size-4"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </DropdownMenuPrimitive.SubTrigger>
  );
};

type DropdownMenuSubContentProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuSubContentProps<T> & {
    class?: string;
  };

const DropdownMenuSubContent = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DropdownMenuSubContentProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuSubContentProps, ['class']);
  return (
    <DropdownMenuPrimitive.SubContent
      class={cn(
        'z-50 min-w-[12rem] origin-[var(--kb-menu-content-transform-origin)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-floating data-[expanded]:animate-in data-[closed]:animate-out',
        local.class
      )}
      {...others}
    />
  );
};

type DropdownMenuCheckboxItemProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuCheckboxItemProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const DropdownMenuCheckboxItem = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DropdownMenuCheckboxItemProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuCheckboxItemProps, ['class', 'children']);
  return (
    <DropdownMenuPrimitive.CheckboxItem
      class={cn(
        'relative flex cursor-default select-none items-center rounded-lg py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        local.class
      )}
      {...others}
    >
      <span class="absolute left-3 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
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
            <path d="M5 12l5 5 10-10" />
          </svg>
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
};

type DropdownMenuGroupLabelProps<T extends ValidComponent = 'span'> =
  DropdownMenuPrimitive.DropdownMenuGroupLabelProps<T> & {
    class?: string;
  };

const DropdownMenuGroupLabel = <T extends ValidComponent = 'span'>(
  props: PolymorphicProps<T, DropdownMenuGroupLabelProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuGroupLabelProps, ['class']);
  return (
    <DropdownMenuPrimitive.GroupLabel
      class={cn('px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500', local.class)}
      {...others}
    />
  );
};

type DropdownMenuRadioItemProps<T extends ValidComponent = 'div'> =
  DropdownMenuPrimitive.DropdownMenuRadioItemProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const DropdownMenuRadioItem = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DropdownMenuRadioItemProps<T>>
) => {
  const [local, others] = splitProps(props as DropdownMenuRadioItemProps, ['class', 'children']);
  return (
    <DropdownMenuPrimitive.RadioItem
      class={cn(
        'relative flex cursor-default select-none items-center rounded-lg py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        local.class
      )}
      {...others}
    >
      <span class="absolute left-3 flex size-3.5 items-center justify-center text-slate-700">
        <DropdownMenuPrimitive.ItemIndicator>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-3"
          >
            <path d="M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0 -16 0" />
          </svg>
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenuPrimitive.RadioItem>
  );
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
};
