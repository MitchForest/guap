import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { DonationCauseGrid } from '../features/donate/components/DonationCauseGrid';
import type { DonationCause } from '@guap/api';

describe('DonationCauseGrid', () => {
  const causes: DonationCause[] = [
    {
      id: 'cause-1',
      name: 'Community Pantry',
      description: 'Support neighbourhood food banks.',
      tags: [],
      recommendedAmount: { cents: 3_500, currency: 'USD' },
    },
  ];

  it('renders causes and emits selection', () => {
    const onSelect = vi.fn();
    render(() => <DonationCauseGrid causes={causes} onSelect={onSelect} />);

    expect(screen.getByText('Community Pantry')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Schedule donation'));
    expect(onSelect).toHaveBeenCalledWith(causes[0]);
  });
});
