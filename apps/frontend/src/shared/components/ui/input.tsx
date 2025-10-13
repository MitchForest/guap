import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/shared/utils/classnames';

const inputVariants = cva(
  'flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/25 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        default: 'h-11 px-4 text-sm',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-5 text-base',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants> & {
    class?: string;
  };

const Input = (props: InputProps) => {
  const [local, others] = splitProps(props, ['class', 'size']);
  return <input class={cn(inputVariants({ size: local.size }), local.class)} {...others} />;
};

const textareaVariants = cva(
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/25 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: {
      resize: 'vertical',
    },
  }
);

type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof textareaVariants> & {
    class?: string;
  };

const Textarea = (props: TextareaProps) => {
  const [local, others] = splitProps(props, ['class', 'resize']);
  return <textarea class={cn(textareaVariants({ resize: local.resize }), local.class)} {...others} />;
};

export { Input, inputVariants, Textarea, textareaVariants };
export type { InputProps, TextareaProps };
