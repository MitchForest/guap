import { createForm } from '@tanstack/solid-form';
import type { FormOptions } from '@tanstack/form-core';
import { mergeProps } from 'solid-js';
import type { z } from 'zod';

type InferInput<TSchema extends z.ZodTypeAny> = z.input<TSchema>;
type InferOutput<TSchema extends z.ZodTypeAny> = z.output<TSchema>;

export type GuapFormConfig<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  defaultValues: InferInput<TSchema>;
  options?: Partial<FormOptions<InferInput<TSchema>, any, any, any, any, any, any, any, any, any, any>>;
  onSubmit: (values: InferOutput<TSchema>) => Promise<void> | void;
};

export const createGuapForm = <TSchema extends z.ZodTypeAny>(config: GuapFormConfig<TSchema>) => {
  const merged = mergeProps({ options: {} }, config);

  return createForm(() => ({
    ...merged.options,
    defaultValues: merged.defaultValues,
    onSubmit: async ({ value }) => {
      const parsed = merged.schema.parse(value);
      await merged.onSubmit(parsed);
    },
  }));
};
