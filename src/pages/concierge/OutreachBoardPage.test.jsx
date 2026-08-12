import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import OutreachBoardPage from './OutreachBoardPage';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const DECLINED = {
  pitch_id: 'p_declined',
  target_name: 'Declined Target',
  proposed_title: 'A list they said no to',
  status: 'declined',
  can_repitch: false,
  item_count: 10,
  resolved_count: 10,
};

const QUIET = {
  pitch_id: 'p_quiet',
  target_name: 'Quiet Target',
  proposed_title: 'A list nobody answered about',
  status: 'no_response',
  can_repitch: true,
  item_count: 10,
  resolved_count: 8,
};

function serve(pitches) {
  client.get.mockImplementation(url =>
    url === '/pitches'
      ? Promise.resolve({ data: { pitches, count: pitches.length } })
      : Promise.reject(new Error('not mocked')),
  );
}

describe('outreach board — re-pitch gating (invariant 1)', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  it('offers re-pitch only on the row the server marked re-pitchable', async () => {
    serve([DECLINED, QUIET]);
    renderWithProviders(<OutreachBoardPage />);

    await screen.findByText('Declined Target');
    const buttons = await screen.findAllByRole('button', { name: /re-pitch/i });
    expect(buttons).toHaveLength(1);

    // …and it belongs to the no-response card, not the declined one.
    const card = buttons[0].closest('div.rounded-lg');
    expect(card.textContent).toContain('Quiet Target');
    expect(card.textContent).not.toContain('Declined Target');
  });

  it('never offers re-pitch on a declined row even if the flag is wrong', async () => {
    serve([{ ...DECLINED, can_repitch: true }]);
    renderWithProviders(<OutreachBoardPage />);

    await screen.findByText('Declined Target');
    expect(screen.queryByRole('button', { name: /re-pitch/i })).toBeNull();
    const card = screen.getByText('Declined Target').closest('div.rounded-lg');
    expect(card.textContent).toMatch(/terminal/i);
  });

  it('falls back to the seeded sample when /pitches is unreachable', async () => {
    client.get.mockRejectedValue(new Error('offline'));
    renderWithProviders(<OutreachBoardPage />);

    await waitFor(() => expect(screen.getByText(/Seeded sample/i)).toBeTruthy());
    // The sample's declined target must not carry a re-pitch action either.
    const declinedCard = screen.getByText('Whitney Adeyemi-Cole').closest('div.rounded-lg');
    expect(declinedCard.textContent).not.toMatch(/re-pitch/i);
  });
});
