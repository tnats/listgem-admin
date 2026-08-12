import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import VerificationTool from './VerificationTool';
import { MOCK_VERIFIED } from './mockVerification';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('verification tool — an empty live list is not a missing one', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  // Prod answers `{ users: [], count: 0 }` today: nobody is verified yet. Falling
  // back to the sample here would show three fictional accounts as holding a
  // real badge, which is the one thing a verification registry must never do.
  it('shows nothing rather than fixtures while the request is in flight', async () => {
    let settle;
    client.get.mockReturnValue(new Promise(resolve => { settle = resolve; }));
    renderWithProviders(<VerificationTool />);

    await screen.findByText(/Loading the live registry/i);
    for (const u of MOCK_VERIFIED) {
      expect(screen.queryByText(u.display_name)).toBeNull();
    }
    settle({ data: { users: [], count: 0 } });
    await screen.findByText(/Live from/i);
  });

  it('renders an empty live registry rather than the fixtures', async () => {
    client.get.mockResolvedValue({ data: { users: [], count: 0 } });
    renderWithProviders(<VerificationTool />);

    await screen.findByText(/Live from/i);
    expect(screen.queryByText(/Seeded sample/i)).toBeNull();
    expect(screen.getByText('No verified accounts.')).toBeTruthy();
    for (const u of MOCK_VERIFIED) {
      expect(screen.queryByText(u.display_name)).toBeNull();
    }
  });

  it('falls back to the sample only when the endpoint is unreachable', async () => {
    client.get.mockRejectedValue(new Error('offline'));
    renderWithProviders(<VerificationTool />);

    // Wait for the fixture row, not the banner: the banner is not the signal
    // that the query has settled.
    expect(await screen.findByText(MOCK_VERIFIED[0].display_name)).toBeTruthy();
    expect(screen.getByText(/Seeded sample/i)).toBeTruthy();
  });
});
