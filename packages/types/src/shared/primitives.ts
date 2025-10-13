import { z } from 'zod';

export const CurrencyAmountSchema = z.object({
  cents: z.number().int(),
  currency: z.string().default('USD'),
});

export type CurrencyAmount = z.infer<typeof CurrencyAmountSchema>;
