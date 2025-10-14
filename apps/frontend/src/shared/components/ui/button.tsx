import type { JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as ButtonPrimitive from '@kobalte/core/button';
import type { ElementOf, PolymorphicProps } from '@kobalte/core/polymorphic';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '~/shared/utils/classnames';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-300',
        secondary: 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-slate-300',
        outline: 'border border-slate-200 bg-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-300',
        ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-300',
        muted: 'border border-transparent bg-slate-100/80 text-slate-700 hover:bg-slate-200 focus-visible:outline-slate-300',
        danger: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-200',
        dangerOutline:
          'border border-rose-200 bg-white text-rose-600 hover:border-rose-300 hover:text-rose-700 focus-visible:outline-rose-200',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-xs',
        xs: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

type ButtonProps<T extends ValidComponent = 'button'> = ButtonPrimitive.ButtonRootProps<T> &
  VariantProps<typeof buttonVariants> & {
    class?: string;
    children?: JSX.Element;
    onClick?: JSX.EventHandlerUnion<ElementOf<T>, MouseEvent>;
  };

const Button = <T extends ValidComponent = 'button'>(props: PolymorphicProps<T, ButtonProps<T>>) => {
  const [local, others] = splitProps(props as ButtonProps, ['variant', 'size', 'class']);
  return (
    <ButtonPrimitive.Root
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  );
};


export { Button, buttonVariants };
export type { ButtonProps };
