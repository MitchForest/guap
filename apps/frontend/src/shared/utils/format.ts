const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (valueCents: number) => currencyFormatter.format(valueCents / 100);

export const formatPercent = (value: number, fractionDigits = 1) =>
  `${value.toFixed(fractionDigits)}%`;
