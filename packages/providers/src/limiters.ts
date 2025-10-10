import { rateLimit, type RateLimiterOptions, type AnyFunction } from '@tanstack/pacer';

export type ProviderRateLimiterOptions<TFn extends AnyFunction> = RateLimiterOptions<TFn> & {
  key?: string;
};

export const createProviderRateLimiter = <TFn extends AnyFunction>(
  fn: TFn,
  options: ProviderRateLimiterOptions<TFn>
) => rateLimit(fn, options);
