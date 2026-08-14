import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import PitchBuilder from './PitchBuilder';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const ITEMS = [{ raw_text: 'Some obscure film', thing_id: null, resolution_status: 'unresolved', position: 0 }];

// A federated hit that exists in TMDB but not in our registry.
const EXTERNAL = {
  results: [
    {
      thing_id: null,
      type: 'Movie',
      title: 'Obscure Film',
      subtitle: null,
      year: 1974,
      source: 'tmdb',
      source_type: 'tmdb_movie',
      source_id: 9911,
      in_registry: false,
    },
  ],
};

function build() {
  renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={ITEMS} />);
}

const searchFor = text => {
  fireEvent.change(screen.getByPlaceholderText(/Search catalogue/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
};

describe('builder — adding a thing we do not hold yet', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
  });

  it('materialises a federated hit and attaches the returned thing_id', async () => {
    client.get.mockResolvedValue({ data: EXTERNAL });
    client.post.mockResolvedValue({
      data: {
        thing_id: 'movie_obscure_film_1974_ab12',
        created: true,
        via: 'kernel_create',
        thing: { thing_id: 'movie_obscure_film_1974_ab12', title: 'Obscure Film', type: 'Movie', year: 1974 },
      },
    });
    build();
    searchFor('Obscure Film');

    fireEvent.click(await screen.findByTitle(/Not in the registry yet/i));

    // Keyed on source_type/source_id — the source mode of the endpoint.
    await vi.waitFor(() =>
      expect(client.post).toHaveBeenCalledWith('/things/resolve-or-create', {
        source_type: 'tmdb_movie',
        source: 'tmdb',
        source_id: '9911',
        type: 'Movie',
      }),
    );
    expect(await screen.findByText(/Added .*Obscure Film.* to the registry/i)).toBeTruthy();
    expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
  });

  it('matches a pasted link against canonical ids', async () => {
    client.get.mockRejectedValue(new Error('no search'));
    client.post.mockResolvedValue({
      data: {
        thing_id: 'movie_the_matrix_1999_14aa79a9',
        created: false,
        via: 'canonical_id',
        thing: { thing_id: 'movie_the_matrix_1999_14aa79a9', title: 'The Matrix', type: 'Movie', year: 1999 },
      },
    });
    build();
    fireEvent.change(screen.getByPlaceholderText(/paste a link/i), {
      target: { value: 'https://www.imdb.com/title/tt0133093/' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    await vi.waitFor(() =>
      expect(client.post).toHaveBeenCalledWith('/things/resolve-or-create', {
        url: 'https://www.imdb.com/title/tt0133093/',
      }),
    );
    expect(await screen.findByText(/Matched .*The Matrix/i)).toBeTruthy();
  });

  it('on a link miss, points at search rather than offering a crawl', async () => {
    // The API will not mint a Thing from a link's metadata — one built from thin
    // OG tags is a permanent low-quality registry entry. Searching produces a
    // better one, so the UI must not offer the worse path.
    client.get.mockRejectedValue(new Error('no search'));
    client.post.mockRejectedValue({ response: { status: 404, data: { found: false } } });
    build();
    fireEvent.change(screen.getByPlaceholderText(/paste a link/i), {
      target: { value: 'https://example.com/nothing' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    expect(await screen.findByText(/search by title instead/i)).toBeTruthy();
    // No crawl-and-create affordance: the endpoint supports it behind
    // { create: true }, and we deliberately don't offer the worse path.
    expect(screen.queryByRole('button', { name: /crawl|create/i })).toBeNull();
  });
});
