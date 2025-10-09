import type { Component, ComponentProps, JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as DialogPrimitive from '@kobalte/core/dialog';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import { cn } from '~/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal: Component<DialogPrimitive.DialogPortalProps> = (props) => {
  const [, rest] = splitProps(props, ['children']);
  return (
    <DialogPrimitive.Portal {...rest}>
      <div class="fixed inset-0 z-40 flex items-start justify-center sm:items-center">
        {props.children}
      </div>
    </DialogPrimitive.Portal>
  );
};

type DialogOverlayProps<T extends ValidComponent = 'div'> = DialogPrimitive.DialogOverlayProps<T> & {
  class?: string;
};

const DialogOverlay = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, DialogOverlayProps<T>>) => {
  const [, rest] = splitProps(props as DialogOverlayProps, ['class']);
  return (
    <DialogPrimitive.Overlay
      class={cn('fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0', props.class)}
      {...rest}
    />
  );
};

type DialogContentProps<T extends ValidComponent = 'div'> = DialogPrimitive.DialogContentProps<T> & {
  class?: string;
  children?: JSX.Element;
};

const DialogContent = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, DialogContentProps<T>>) => {
  const [, rest] = splitProps(props as DialogContentProps, ['class', 'children']);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        class={cn(
          'relative z-50 w-full max-w-lg origin-[var(--kb-transform-origin)] rounded-3xl border border-slate-200/70 bg-white p-8 shadow-floating outline-none data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95',
          props.class
        )}
        {...rest}
      >
        {props.children}
        <DialogPrimitive.CloseButton
          class="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          aria-label="Close dialog"
        >
          <span class="sr-only">Close dialog</span>
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
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </DialogPrimitive.CloseButton>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

const DialogHeader: Component<ComponentProps<'div'>> = (props) => {
  const [, rest] = splitProps(props, ['class']);
  return <div class={cn('flex flex-col gap-2 text-center sm:text-left', props.class)} {...rest} />;
};

const DialogFooter: Component<ComponentProps<'div'>> = (props) => {
  const [, rest] = splitProps(props, ['class']);
  return (
    <div class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3', props.class)} {...rest} />
  );
};

type DialogTitleProps<T extends ValidComponent = 'h2'> = DialogPrimitive.DialogTitleProps<T> & {
  class?: string;
};

const DialogTitle = <T extends ValidComponent = 'h2'>(props: PolymorphicProps<T, DialogTitleProps<T>>) => {
  const [, rest] = splitProps(props as DialogTitleProps, ['class']);
  return <DialogPrimitive.Title class={cn('text-xl font-semibold text-slate-900', props.class)} {...rest} />;
};

type DialogDescriptionProps<T extends ValidComponent = 'p'> = DialogPrimitive.DialogDescriptionProps<T> & {
  class?: string;
};

const DialogDescription = <T extends ValidComponent = 'p'>(props: PolymorphicProps<T, DialogDescriptionProps<T>>) => {
  const [, rest] = splitProps(props as DialogDescriptionProps, ['class']);
  return <DialogPrimitive.Description class={cn('text-sm text-subtle', props.class)} {...rest} />;
};

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
