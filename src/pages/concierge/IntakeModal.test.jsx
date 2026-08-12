import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
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
