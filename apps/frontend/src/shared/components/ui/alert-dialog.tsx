import type { Component, ComponentProps, JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as AlertDialogPrimitive from '@kobalte/core/alert-dialog';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import { cn } from '~/shared/utils/classnames';
import { Button, type ButtonProps } from './button';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal: Component<AlertDialogPrimitive.AlertDialogPortalProps> = (props) => {
  const [, rest] = splitProps(props, ['children']);
  return (
    <AlertDialogPrimitive.Portal {...rest}>
      <div class="fixed inset-0 z-40 flex items-start justify-center sm:items-center">
        {props.children}
      </div>
    </AlertDialogPrimitive.Portal>
  );
};

type AlertDialogOverlayProps<T extends ValidComponent = 'div'> =
  AlertDialogPrimitive.AlertDialogOverlayProps<T> & {
    class?: string;
  };

const AlertDialogOverlay = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, AlertDialogOverlayProps<T>>,
) => {
  const [, rest] = splitProps(props as AlertDialogOverlayProps, ['class']);
  return (
    <AlertDialogPrimitive.Overlay
      class={cn(
        'fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0',
        props.class,
      )}
      {...rest}
    />
  );
};

type AlertDialogContentProps<T extends ValidComponent = 'div'> =
  AlertDialogPrimitive.AlertDialogContentProps<T> & {
    class?: string;
    children?: JSX.Element;
  };

const AlertDialogContent = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, AlertDialogContentProps<T>>,
) => {
  const [, rest] = splitProps(props as AlertDialogContentProps, ['class', 'children']);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        class={cn(
          'relative z-50 w-full max-w-md origin-[var(--kb-transform-origin)] rounded-3xl border border-slate-200/70 bg-white p-6 shadow-floating outline-none data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95',
          props.class,
        )}
        {...rest}
      >
        {props.children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
};

const AlertDialogHeader: Component<ComponentProps<'div'>> = (props) => {
  const [, rest] = splitProps(props, ['class']);
  return <div class={cn('flex flex-col gap-2 text-left', props.class)} {...rest} />;
};

const AlertDialogFooter: Component<ComponentProps<'div'>> = (props) => {
  const [, rest] = splitProps(props, ['class']);
  return (
    <div class={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3', props.class)} {...rest} />
  );
};

type AlertDialogTitleProps<T extends ValidComponent = 'h2'> =
  AlertDialogPrimitive.AlertDialogTitleProps<T> & {
    class?: string;
  };

const AlertDialogTitle = <T extends ValidComponent = 'h2'>(
  props: PolymorphicProps<T, AlertDialogTitleProps<T>>,
) => {
  const [, rest] = splitProps(props as AlertDialogTitleProps, ['class']);
  return (
    <AlertDialogPrimitive.Title
      class={cn('text-lg font-semibold text-slate-900', props.class)}
      {...rest}
    />
  );
};

type AlertDialogDescriptionProps<T extends ValidComponent = 'p'> =
  AlertDialogPrimitive.AlertDialogDescriptionProps<T> & {
    class?: string;
  };

const AlertDialogDescription = <T extends ValidComponent = 'p'>(
  props: PolymorphicProps<T, AlertDialogDescriptionProps<T>>,
) => {
  const [, rest] = splitProps(props as AlertDialogDescriptionProps, ['class']);
  return (
    <AlertDialogPrimitive.Description
      class={cn('text-sm text-subtle', props.class)}
      {...rest}
    />
  );
};

const AlertDialogAction: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props as ButtonProps, ['variant', 'size']);
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button
        variant={local.variant ?? 'primary'}
        size={local.size ?? 'sm'}
        {...others}
      />
    </AlertDialogPrimitive.Action>
  );
};

const AlertDialogCancel: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props as ButtonProps, ['variant', 'size']);
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button
        variant={local.variant ?? 'secondary'}
        size={local.size ?? 'sm'}
        {...others}
      />
    </AlertDialogPrimitive.Cancel>
  );
};

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
