const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const formatMonths = (value: number | null) => {
  if (value === null) return 'Not reached';
  if (value === 0) return 'Now';
  const years = Math.floor(value / 12);
  const months = value % 12;
  const yearSegment = years > 0 ? `${years} yr${years === 1 ? '' : 's'}` : '';
  const monthSegment = months > 0 ? `${months} mo${months === 1 ? '' : 's'}` : '';
  return [yearSegment, monthSegment].filter(Boolean).join(' ').trim();
};

export { currencyFormatter, formatMonths };
