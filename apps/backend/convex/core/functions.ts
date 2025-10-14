import { mutation, query } from '../_generated/server';
import {
  zCustomMutation,
  zCustomQuery,
  type ZodValidator,
} from 'convex-helpers/server/zod';
import { NoOp } from 'convex-helpers/server/customFunctions';

type InferArgs<Args extends ZodValidator | undefined> = Args extends ZodValidator
  ? Record<string, unknown>
  : Record<string, never>;

type QueryOptions<Args extends ZodValidator | undefined, Result> = {
  args?: Args;
  returns?: unknown;
  handler: (ctx: any, args: InferArgs<Args>) => Result;
};

type MutationOptions<Args extends ZodValidator | undefined, Result> = {
  args?: Args;
  returns?: unknown;
  handler: (ctx: any, args: InferArgs<Args>) => Result;
};

export const defineQuery = <Args extends ZodValidator | undefined, Result>(options: QueryOptions<Args, Result>) => {
  const builder = zCustomQuery(query, NoOp);
  const config: Record<string, unknown> = {};

  if (options.args) {
    config.args = options.args;
  }

  if (options.returns) {
    config.returns = options.returns;
  }

  return builder({
    ...config,
    handler: (ctx, args) => options.handler(ctx, args as InferArgs<Args>),
  });
};

export const defineMutation = <Args extends ZodValidator | undefined, Result>(
  options: MutationOptions<Args, Result>
) => {
  const builder = zCustomMutation(mutation, NoOp);
  const config: Record<string, unknown> = {};

  if (options.args) {
    config.args = options.args;
  }

  if (options.returns) {
    config.returns = options.returns;
  }

  return builder({
    ...config,
    handler: (ctx, args) => options.handler(ctx, args as InferArgs<Args>),
  });
};
