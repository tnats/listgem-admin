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

  it('adds a NEW item from a link rather than re-pointing an existing row', async () => {
    // Reported: pasting an IMDb link said "Matched The Usual Suspects" and
    // nothing appeared in the list — because the only link box re-pointed the
    // focused row, silently replacing whatever it already matched.
    client.get.mockRejectedValue(new Error('no search'));
    client.post.mockResolvedValue({
      data: {
        thing_id: 'movie_usual_suspects_1995_c3',
        created: false,
        via: 'canonical_id',
        thing: { thing_id: 'movie_usual_suspects_1995_c3', title: 'The Usual Suspects', type: 'Movie', year: 1995 },
      },
    });
    build();
    // The add panel is collapsed once a pitch has items — this is the path an
    // operator takes to add one more.
    fireEvent.click(screen.getByRole('button', { name: /add items or a link/i }));

    fireEvent.change(screen.getByPlaceholderText(/imdb\.com\/title/i), {
      target: { value: 'https://www.imdb.com/title/tt0114814/' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(await screen.findByText(/Added .*The Usual Suspects.* as item 2/i)).toBeTruthy();
    // The original row is untouched, and there are now two.
    expect(screen.getByText('Some obscure film')).toBeTruthy();
    expect(screen.getAllByText('The Usual Suspects').length).toBeGreaterThan(0);
  });

  it('names the row it matched, and what it replaced when re-pointing', async () => {
    client.get.mockRejectedValue(new Error('no search'));
    client.post.mockResolvedValue({
      data: {
        thing_id: 'movie_usual_suspects_1995_c3',
        created: false,
        thing: { thing_id: 'movie_usual_suspects_1995_c3', title: 'The Usual Suspects', type: 'Movie' },
      },
    });
    build();
    fireEvent.change(screen.getByPlaceholderText(/Match row 1 using a link/i), {
      target: { value: 'https://www.imdb.com/title/tt0114814/' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    // Says which row changed — an unannounced overwrite of a correct match is
    // the expensive mistake here.
    expect(await screen.findByText(/Row 1 matched to .*The Usual Suspects/i)).toBeTruthy();
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
    fireEvent.change(screen.getByPlaceholderText(/Match row 1 using a link/i), {
      target: { value: 'https://www.imdb.com/title/tt0133093/' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    await vi.waitFor(() =>
      expect(client.post).toHaveBeenCalledWith('/things/resolve-or-create', {
        url: 'https://www.imdb.com/title/tt0133093/',
      }),
    );
    expect(await screen.findByText(/Row 1 matched to .*The Matrix/i)).toBeTruthy();
  });

  it('on a 404 says what it read, then runs the search itself', async () => {
    // A 404 means we read the identifier and don't hold the thing — a coverage
    // gap, not a bad link. The film is in TMDB, so searching lands the operator
    // on a result they can add in one click. Describing that is worse than
    // doing it.
    client.post.mockRejectedValue({
      response: { status: 404, data: { found: false, canonical_ids: { imdb_id: 'tt0060827' } } },
    });
    client.get.mockResolvedValue({
      data: { results: [{ thing_id: null, title: 'Persona', type: 'Movie', year: 1966, source: 'tmdb', source_type: 'tmdb_movie', source_id: 605, in_registry: false }] },
    });
    build();
    fireEvent.change(screen.getByPlaceholderText(/Match row 1 using a link/i), {
      target: { value: 'https://www.imdb.com/title/tt0060827/?ref_=fn_t_2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    expect(await screen.findByText(/Link read \(imdb_id tt0060827\) but not in our registry/i)).toBeTruthy();
    // …and the search ran, so the addable result is already on screen.
    expect(await screen.findByTitle(/Not in the registry yet/i)).toBeTruthy();
    // Still no crawl-and-create affordance: the API supports it behind
    // { create: true } and it produces a worse entry than the source APIs.
    expect(screen.queryByRole('button', { name: /crawl/i })).toBeNull();
  });

  it('a link with no identifier is a different problem, and says so', async () => {
    client.get.mockRejectedValue(new Error('no search'));
    client.post.mockRejectedValue({ response: { status: 422, data: { error: 'No canonical id in that URL' } } });
    build();
    fireEvent.change(screen.getByPlaceholderText(/Match row 1 using a link/i), {
      target: { value: 'https://example.com/some-blog-post' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    expect(await screen.findByText(/No identifier in that link/i)).toBeTruthy();
  });
});

describe('builder — the link box says what it will do', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockRejectedValue(new Error('no search'));
  });

  // "Re-point" presumes the row already points somewhere. On an unresolved row
  // it hid the box from an operator looking for a way to match one.
  it('offers to MATCH a row that resolved to nothing', () => {
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={ITEMS} />);
    expect(screen.getByPlaceholderText(/Match row 1 using a link/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^match$/i })).toBeTruthy();
  });

  it('offers to RE-POINT a row that already has a match', () => {
    const resolved = [
      { raw_text: 'Persona', thing_id: 'movie_persona_1966_aa', resolution_status: 'resolved', position: 0 },
    ];
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={resolved} />);
    expect(screen.getByPlaceholderText(/Re-point row 1 using a link/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /re-point/i })).toBeTruthy();
  });
});
