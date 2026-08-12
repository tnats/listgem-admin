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
    expect(screen.getByText('https://listgem.com/pitch/pv_1')).toBeTruthy();
    expect(screen.getByText('https://listgem.com/signup?invite=inv_1')).toBeTruthy();
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
