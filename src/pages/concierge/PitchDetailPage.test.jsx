import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import PitchDetailPage from './PitchDetailPage';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const BASE = {
  pitch_id: 'p_1',
  target_name: 'Sample Target',
  proposed_title: 'A rebuilt list',
  thing_type: 'Movie',
  status: 'accepted',
  can_repitch: false,
  target_contact: 'target@example.com',
  item_count: 2,
  resolved_count: 2,
};

function serve(pitch, items = []) {
  client.get.mockImplementation(url =>
    url === '/pitches/p_1'
      ? Promise.resolve({ data: { pitch, items, events: [] } })
      : Promise.reject(new Error('not mocked')),
  );
}

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/concierge/:pitchId" element={<PitchDetailPage />} />
    </Routes>,
    { route: '/concierge/p_1' },
  );
}

const tab = name => fireEvent.click(screen.getByRole('button', { name }));

describe('pitch detail — identity confirmation (invariant 3)', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  it('does not offer confirmation before the claim', async () => {
    serve({ ...BASE, status: 'accepted' });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Identity');
    expect(screen.getByRole('button', { name: /confirm identity/i }).disabled).toBe(true);
    expect(screen.getByText(/requires status/i)).toBeTruthy();
  });

  it('offers it once the target has claimed the draft', async () => {
    serve({ ...BASE, status: 'provisioned', provisioned_user_id: 'usr_1' });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Identity');
    expect(screen.getByRole('button', { name: /confirm identity/i }).disabled).toBe(false);
  });

  it('keeps the confirm button disabled until evidence is written (invariant 2)', async () => {
    serve({ ...BASE, status: 'provisioned' });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Identity');
    fireEvent.click(screen.getByRole('button', { name: /confirm identity…/i }));

    const dialog = await screen.findByRole('dialog');
    const submit = [...dialog.querySelectorAll('button')].find(b => /^confirm identity$/i.test(b.textContent));
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/evidence/i), { target: { value: 'Confirmed by email 2026-08-11' } });
    expect(submit.disabled).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('pitch detail — item editing and takedown', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  it('freezes the item set once the target has claimed it', async () => {
    serve({ ...BASE, status: 'provisioned' }, [{ raw_text: 'A', thing_id: 'thing_a', resolution_status: 'resolved' }]);
    renderDetail();
    await screen.findByText(/claimed this draft/i);
    expect(screen.queryByRole('button', { name: /save items/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^drop$/i })).toBeNull();
  });

  it('allows editing while the draft is still ours', async () => {
    serve({ ...BASE, status: 'draft' }, [{ raw_text: 'A', thing_id: 'thing_a', resolution_status: 'resolved' }]);
    renderDetail();
    expect(await screen.findByRole('button', { name: /save items/i })).toBeTruthy();
  });

  it('offers takedown once, and not on an already-archived pitch', async () => {
    serve({ ...BASE, status: 'archived', target_contact: null });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Outreach');
    expect(screen.getByRole('button', { name: /take down/i }).disabled).toBe(true);
    expect(screen.getByText(/contact was purged/i)).toBeTruthy();
  });

  it('describes takedown as one action with all three effects (invariant 4)', async () => {
    serve({ ...BASE, status: 'pitched' });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Outreach');
    fireEvent.click(screen.getByRole('button', { name: /take down/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/purged/i);
    expect(dialog.textContent).toMatch(/revoked/i);
    expect(dialog.textContent).toMatch(/archived/i);
  });
});

describe('pitch detail — token issuing', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  it('refuses to re-issue after the invite was claimed', async () => {
    serve({ ...BASE, status: 'provisioned', invite_used_at: '2026-08-10T08:14:00Z', invite_token: 'inv_1' });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Outreach');
    expect(screen.getByRole('button', { name: /re-issue tokens/i }).disabled).toBe(true);
    expect(screen.getByText(/claimed twice/i)).toBeTruthy();
  });

  it('shows both public links when tokens exist', async () => {
    serve({ ...BASE, invite_token: 'inv_1', preview_token: 'pv_1' });
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Outreach');
    // Host comes from VITE_PUBLIC_SITE_URL and changes when the public surfaces
    // move domain; the paths are the contract.
    expect(screen.getByText(/\/pitch\/pv_1$/)).toBeTruthy();
    expect(screen.getByText(/\/signup\?invite=inv_1$/)).toBeTruthy();
  });
});

describe('pitch detail — status transitions', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  it('offers only archive out of a decline', async () => {
    serve({ ...BASE, status: 'declined', can_repitch: true });
    renderDetail();
    await screen.findByText('A rebuilt list');
    const moveTo = screen.getByText('Move to').parentElement;
    const offered = [...moveTo.querySelectorAll('button')].map(b => b.textContent.trim());
    expect(offered).toEqual(['Archived']);
  });
});

describe('pitch detail — an expired invite may be a deliberate hold', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
  });

  // Expiring an invite is how a pitch gets paused, and the reason lives in the
  // audit trail rather than in any field the portal can read. Re-issuing
  // replaces both tokens and lifts the hold silently.
  const HELD = {
    ...BASE,
    status: 'pitched',
    invite_token: 'inv_1',
    preview_token: 'pv_1',
    invite_expires_at: '2026-08-01T00:00:00Z',
    invite_used_at: null,
  };

  function serveHeld() {
    client.get.mockImplementation(url =>
      url === '/pitches/p_1'
        ? Promise.resolve({
            data: {
              pitch: HELD,
              items: [],
              events: [
                { event_type: 'tokens_issued', detail: 'invite + preview issued', actor: 'gtm@listgem.com', created_at: '2026-07-20T10:00:00Z' },
                { event_type: 'status_changed', detail: 'invite expired to hold the pitch pending legal review', actor: 'gtm@listgem.com', created_at: '2026-08-01T09:00:00Z' },
              ],
            },
          })
        : Promise.reject(new Error('not mocked')),
    );
  }

  it('warns, shows the last audit line, and takes two presses to re-issue', async () => {
    serveHeld();
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Outreach');

    expect(screen.getByText(/expired while the pitch is still pitched/i)).toBeTruthy();
    // The reason is a tab away otherwise, and that's the tab nobody opens.
    expect(screen.getByText(/hold the pitch pending legal review/i)).toBeTruthy();

    const button = screen.getByRole('button', { name: /re-issue tokens…/i });
    fireEvent.click(button);
    expect(client.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Press again to re-issue and lift the hold/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^re-issue tokens$/i }));
    await vi.waitFor(() => expect(client.post).toHaveBeenCalledWith('/pitches/p_1/tokens'));
  });

  it('does not nag when the invite expired on a pitch nobody is chasing', async () => {
    client.get.mockImplementation(url =>
      url === '/pitches/p_1'
        ? Promise.resolve({ data: { pitch: { ...HELD, status: 'declined' }, items: [], events: [] } })
        : Promise.reject(new Error('not mocked')),
    );
    renderDetail();
    await screen.findByText('A rebuilt list');
    tab('Outreach');

    expect(screen.queryByText(/expired while the pitch is still/i)).toBeNull();
  });
});
