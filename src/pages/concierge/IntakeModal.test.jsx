import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import IntakeModal from './IntakeModal';
import { RETIRED_THING_TYPES } from '../../taxonomy';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// Trimmed from the real GET /types, 2026-08-12. Note Cafe: the canonical
// vocabulary still ships the retired types with supported: true.
const TYPES = {
  types: [
    { type: 'Movie', display_name: 'Movie', icon: '🎬', parent_type: 'CreativeWork', supported: true, count: 11943 },
    { type: 'Restaurant', display_name: 'Restaurant', icon: '🍽️', parent_type: 'Place', supported: true, count: 1429 },
    { type: 'Beach', display_name: 'Beach', icon: '🏖️', parent_type: 'Place', supported: true, count: 0 },
    { type: 'Cafe', display_name: 'Cafe', icon: '☕', parent_type: 'Place', supported: true, count: 2 },
  ],
};

const optionText = () => [...document.querySelectorAll('#thing_type option')].map(o => o.textContent);

describe('intake type picker', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  it('offers the canonical vocabulary, deepest registry first', async () => {
    client.get.mockResolvedValue({ data: TYPES });
    renderWithProviders(<IntakeModal open onClose={() => {}} />);

    await screen.findByText(/🎬 Movie/);
    // count is registry depth — a fair proxy for how well a type will resolve.
    expect(optionText().slice(1)).toEqual([
      '🎬 Movie · 11,943',
      '🍽️ Restaurant · 1,429',
      '🏖️ Beach',
    ]);
  });

  it('never offers a retired type, even though /types still returns them', async () => {
    // Creating rows under a retired type manufactures the drift the Taxonomy
    // Health panel (#456) exists to detect.
    client.get.mockResolvedValue({ data: TYPES });
    renderWithProviders(<IntakeModal open onClose={() => {}} />);

    await screen.findByText(/🎬 Movie/);
    for (const retired of RETIRED_THING_TYPES) {
      expect(optionText().some(t => t.includes(retired))).toBe(false);
    }
  });

  it('has no free-text escape hatch — it could only ever produce a 400', async () => {
    client.get.mockResolvedValue({ data: TYPES });
    renderWithProviders(<IntakeModal open onClose={() => {}} />);

    await screen.findByText(/🎬 Movie/);
    expect(optionText().some(t => /other/i.test(t))).toBe(false);
    expect(screen.queryByPlaceholderText(/Exact registry type/i)).toBeNull();
  });

  it('falls back to the offline list when /types is unreachable', async () => {
    client.get.mockRejectedValue(new Error('offline'));
    renderWithProviders(<IntakeModal open onClose={() => {}} />);

    await screen.findByText(/unreachable/i);
    expect(optionText()).toContain('Movie');
  });
});

describe('intake form focus', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.get.mockResolvedValue({ data: TYPES });
  });

  it('leaves the caret where the operator put it', async () => {
    renderWithProviders(<IntakeModal open onClose={() => {}} />);
    await screen.findByText(/🎬 Movie/);

    const title = screen.getByLabelText(/Proposed title/i);
    title.focus();
    fireEvent.change(title, { target: { value: 'Essential Nordic Noir' } });

    expect(document.activeElement).toBe(title);
    expect(screen.getByLabelText(/Target name/i).value).toBe('');
  });
});

describe('assignee picker', () => {
  const STAFF = {
    users: [
      { user_id: 'u1', email: 'gtm@listgem.com', username: 'gtm', is_admin: true, is_moderator: false },
      { user_id: 'u2', email: 'mod@listgem.com', username: 'mod', is_admin: false, is_moderator: true },
      { user_id: 'u3', email: 'someone@example.com', username: 'someone', is_admin: false, is_moderator: false },
    ],
    total: 3,
  };

  beforeEach(() => {
    client.get.mockReset();
    client.get.mockImplementation(url =>
      url === '/types'
        ? Promise.resolve({ data: TYPES })
        : url === '/admin/users'
          ? Promise.resolve({ data: STAFF })
          : Promise.reject(new Error('not mocked')),
    );
  });

  // assigned_to is free text server-side and the board filter matches it
  // exactly, so a typo returns an empty board with no error. A closed list of
  // real accounts removes the failure rather than documenting it.
  it('offers portal staff only, never a free-text box', async () => {
    renderWithProviders(<IntakeModal open onClose={() => {}} />);
    await screen.findByText('gtm@listgem.com');

    const options = [...document.querySelectorAll('#assigned_to option')].map(o => o.textContent);
    expect(options).toEqual(['Unassigned', 'gtm@listgem.com', 'mod@listgem.com']);
    expect(document.querySelector('input#assigned_to')).toBeNull();
  });
});
