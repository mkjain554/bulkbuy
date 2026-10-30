import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PoolCard } from './PoolCard';
import type { Pool } from '../types';

const pool: Pool = {
  id: '00000000-0000-4000-8000-000000000201',
  title: 'Studio group offer',
  description: 'A sample offer for a group of buyers.',
  regularPrice: '2500.00',
  groupPrice: '1999.50',
  currency: 'INR',
  minBuyers: 4,
  maxParticipants: 10,
  startsAt: new Date().toISOString(),
  closesAt: new Date(Date.now() + 86400000).toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'ACTIVE',
  product: {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Studio headphones',
    brand: 'Auraloop',
    description: 'Noise cancelling headphones.',
    imageUrl: null,
    category: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Audio',
      slug: 'audio',
    },
    seller: { id: '00000000-0000-4000-8000-000000000002', name: 'Seller' },
  },
  formFields: [],
  _count: { participations: 2 },
};

describe('PoolCard', () => {
  it('shows exact INR paise and target progress, and opens the pool', () => {
    const onOpen = vi.fn();
    render(<PoolCard pool={pool} onOpen={onOpen} />);

    expect(screen.getByText('₹1,999.5')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '50',
    );

    fireEvent.click(screen.getByRole('button', { name: /view pool/i }));
    expect(onOpen).toHaveBeenCalledWith(pool);
  });
});
