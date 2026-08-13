import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import OutreachBoardPage from './OutreachBoardPage';
import { MOCK_PITCHES } from './mockPitches';
import { BOARD_COLUMNS } from './pitchRules';

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

describe('outreach board — an empty live list is not a missing one', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  // pitch_lists is legitimately empty in prod (listgem-platform#536 deleted the
  // last fixtures). The other read-only pages in this repo treat an empty array
  // as "fall back to the sample" — here that would put seven invented people
  // with example.* contacts on the board that decides who staff contact next.
  // Empty means empty.
  it('shows nothing rather than fixtures while the request is in flight', async () => {
    let settle;
    client.get.mockReturnValue(new Promise(resolve => { settle = resolve; }));
    renderWithProviders(<OutreachBoardPage />);

    await screen.findByText(/Loading the live board/i);
    for (const p of MOCK_PITCHES) {
      expect(screen.queryByText(p.target_name)).toBeNull();
    }
    settle({ data: { pitches: [], count: 0 } });
    await screen.findByText(/Live board/i);
  });

  it('renders an empty live board rather than the fixtures', async () => {
    serve([]);
    renderWithProviders(<OutreachBoardPage />);

    await screen.findByText(/Live board/i);
    expect(screen.queryByText(/Seeded sample/i)).toBeNull();
    // Every column empty — the count text is split across nodes, the columns aren't.
    expect(screen.getAllByText('empty')).toHaveLength(BOARD_COLUMNS.length);
    // Not one fixture name may reach the DOM.
    for (const p of MOCK_PITCHES) {
      expect(screen.queryByText(p.target_name)).toBeNull();
    }
  });
});

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

describe('outreach board — assignee filter', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  // Previously a free-text box sent to the server as an exact match, so one
  // typo returned an empty board with no error. Now a closed list, filtered
  // client-side so every value on the board is always offered.
  it('offers every assignee present on the board and filters to it', async () => {
    client.get.mockImplementation(url =>
      url === '/pitches'
        ? Promise.resolve({
            data: {
              pitches: [
                { ...QUIET, assigned_to: 'gtm@listgem.com' },
                { ...DECLINED, assigned_to: 'ops@listgem.com' },
              ],
            },
          })
        : Promise.reject(new Error('not mocked')),
    );
    renderWithProviders(<OutreachBoardPage />);
    await screen.findByText('Quiet Target');

    const select = document.querySelectorAll('select')[1];
    expect([...select.options].map(o => o.textContent)).toEqual([
      'All assignees',
      'gtm@listgem.com',
      'ops@listgem.com',
    ]);

    fireEvent.change(select, { target: { value: 'ops@listgem.com' } });
    expect(screen.queryByText('Quiet Target')).toBeNull();
    expect(screen.getByText('Declined Target')).toBeTruthy();
  });
});
