import { useState } from 'react';
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

describe('builder — unresolved rows search themselves', () => {
  const TWO = [
    { raw_text: 'Persona (1966) 🇸🇪 8.6/10', thing_id: null, resolution_status: 'unresolved', position: 0 },
    { raw_text: 'The Hunt (2012)', thing_id: 'movie_the_hunt_2012_aa', resolution_status: 'resolved', position: 1 },
  ];

  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockResolvedValue({ data: { results: [] } });
  });

  it('pre-fills the box with the cleaned title, not the raw text', () => {
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={TWO} />);
    expect(screen.getByDisplayValue('Persona')).toBeTruthy();
  });

  it('runs the search itself once focus settles on an unresolved row', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={TWO} />);
    expect(client.get).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(700);
    await vi.waitFor(() =>
      // 25, not 10: registry hits sort first, so a common word fills every slot
      // with local partial matches and the external result never appears.
      expect(client.get).toHaveBeenCalledWith('/search-to-add', {
        params: { query: 'Persona', type: 'Movie', limit: 25 },
      }),
    );
    vi.useRealTimers();
  });

  it('does not search a row that already resolved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Row 2 is resolved; focusing it should spend nothing.
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={[TWO[1]]} />);
    await vi.advanceTimersByTimeAsync(1500);
    expect(client.get).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('spends nothing on rows passed through by keyboard', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const many = Array.from({ length: 6 }, (_, i) => ({
      raw_text: `Unmatched ${i}`,
      thing_id: null,
      resolution_status: 'unresolved',
      position: i,
    }));
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={many} />);

    // j j j j — straight past four rows inside the settle window.
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(window, { key: 'j' });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(client.get).not.toHaveBeenCalled();

    // …and one search once it settles, for the row actually landed on.
    await vi.advanceTimersByTimeAsync(700);
    await vi.waitFor(() => expect(client.get).toHaveBeenCalledTimes(1));
    expect(client.get.mock.calls[0][1].params.query).toBe('Unmatched 4');
    vi.useRealTimers();
  });
});

describe('builder — an item of the wrong type cannot be saved', () => {
  // A Movie pitch holding a TVSeries saves fine and then fails at provisioning,
  // because validate_thing_type_match lives on list_items, not pitch_list_items.
  // The error surfaces when the target clicks the invite — on them, not us.
  const POISONED = [
    {
      raw_text: 'Persona (1966) 🇸🇪 8.6/10',
      thing_id: 'tvseries_have_i_got_news_for_you_1990_cf27f995',
      resolution_status: 'resolved',
      position: 0,
      thing_type_actual: 'TVSeries',
      thing_metadata: { title: 'Have I Got News for You', year: 1990 },
    },
  ];

  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.put.mockReset();
    client.get.mockRejectedValue(new Error('no search'));
  });

  it('flags the row, explains the consequence, and blocks the save', () => {
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={POISONED} />);

    expect(screen.getByText('wrong type')).toBeTruthy();
    expect(screen.getByText(/Row 1 is not Movie/i)).toBeTruthy();
    expect(screen.getByText(/rejects a mismatch when the target claims/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /save items/i }).disabled).toBe(true);
    expect(client.put).not.toHaveBeenCalled();
  });

  it('saves normally when the types agree', () => {
    const clean = [{ ...POISONED[0], thing_id: 'movie_persona_1966_aa', thing_type_actual: 'Movie' }];
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={clean} />);

    expect(screen.queryByText('wrong type')).toBeNull();
    expect(screen.getByRole('button', { name: /save items/i }).disabled).toBe(false);
  });
});

describe('builder — a link we recognise but do not hold', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockResolvedValue({ data: { results: [] } });
  });

  it('offers to fetch it, polls the crawl, and attaches the result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // First call: identify-only, 404 with the id we read. Second: create.
    client.post
      .mockRejectedValueOnce({ response: { status: 404, data: { canonical_ids: { imdb_id: 'tt0060827' } } } })
      .mockResolvedValueOnce({ data: { status: 'queued', crawl_id: 'crawl_1' } })
      .mockResolvedValueOnce({
        data: { thing_id: 'movie_persona_1966_zz', created: true, thing: { title: 'Persona', type: 'Movie', year: 1966 } },
      });
    client.get.mockImplementation(url =>
      url === '/ingestion/crawl-status/crawl_1'
        ? Promise.resolve({ data: { status: 'completed', thingId: 'movie_persona_1966_zz' } })
        : Promise.resolve({ data: { results: [] } }),
    );

    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={ITEMS} />);
    fireEvent.change(screen.getByPlaceholderText(/Match row 1 using a link/i), {
      target: { value: 'https://www.imdb.com/title/tt0060827/' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    // The offer names what was read, so it reads as a recognised link rather
    // than a guess at an arbitrary page.
    const offer = await screen.findByRole('button', { name: /add it from this link/i });
    // The id appears twice — in the note and in the offer. The offer's copy is
    // what says the link was recognised rather than guessed at.
    expect(screen.getByText(/We read imdb_id tt0060827 from that link/i)).toBeTruthy();

    fireEvent.click(offer);
    await vi.advanceTimersByTimeAsync(3500);

    expect(await screen.findByText(/Added .*Persona.* and attached it to row 1/i)).toBeTruthy();
    expect(client.post).toHaveBeenCalledWith('/things/resolve-or-create', {
      url: 'https://www.imdb.com/title/tt0060827/',
      create: true,
    });
    vi.useRealTimers();
  });

  it('does not offer a crawl for a link carrying no identifier', async () => {
    client.post.mockRejectedValue({ response: { status: 422, data: { error: 'No canonical id in that URL' } } });
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={ITEMS} />);
    fireEvent.change(screen.getByPlaceholderText(/Match row 1 using a link/i), {
      target: { value: 'https://example.com/a-blog-post' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^match$/i }));

    expect(await screen.findByText(/No identifier in that link/i)).toBeTruthy();
    // Crawling an arbitrary page mints an entry from whatever it happened to
    // expose; that stays unavailable.
    expect(screen.queryByRole('button', { name: /add it from this link/i })).toBeNull();
  });
});

describe('builder — a wrong match must not steer the search that fixes it', () => {
  // Reported: searching Persona on a Movie pitch returned twenty TVSeries
  // (Persona 4 the Animation, Persona 5 the Animation…). The row had mismatched
  // to a TVSeries, the row's type won over the pitch's, and the search queried
  // TMDB's TV index — so the film could not appear at all.
  const MISMATCHED = [
    {
      raw_text: 'Persona (1966) 🇸🇪 8.6/10',
      thing_id: 'tvseries_have_i_got_news_for_you_1990_cf27f995',
      resolution_status: 'resolved',
      position: 0,
      thing_type_actual: 'TVSeries',
      thing_metadata: { title: 'Have I Got News for You', year: 1990 },
    },
  ];

  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockResolvedValue({ data: { results: [] } });
  });

  it('searches as the pitch type, not as the wrong match', async () => {
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={MISMATCHED} />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await vi.waitFor(() =>
      expect(client.get).toHaveBeenCalledWith('/search-to-add', {
        params: { query: 'Persona', type: 'Movie', limit: 25 },
      }),
    );
  });
});

describe('builder — picking says what it attached', () => {
  // A registry pick used to be silent: click, and nothing told you which of
  // twenty near-identical results landed. A mis-click looked exactly like a
  // correct one until you re-read the table.
  const RESULTS = {
    results: [
      { thing_id: 'movie_persona3_4_2016_zz', title: 'Persona3 the Movie #4 Winter of Rebirth', type: 'Movie', year: 2016, source: 'local', in_registry: true },
      { thing_id: 'movie_persona_1966_aa', title: 'Persona', type: 'Movie', year: 1966, source: 'local', in_registry: true },
    ],
  };

  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockResolvedValue({ data: RESULTS });
  });

  it('names the title and year it attached, and what it replaced', async () => {
    const wrong = [
      {
        raw_text: 'Persona (1966) 🇸🇪 8.6/10',
        thing_id: 'movie_persona3_4_2016_zz',
        resolution_status: 'resolved',
        position: 0,
        thing_type_actual: 'Movie',
        thing_metadata: { title: 'Persona3 the Movie #4 Winter of Rebirth', year: 2016 },
      },
    ];
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={wrong} />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    // The results list is labelled, so it can't be confused with the
    // Candidates list stacked above it.
    await screen.findByText(/Search results \(2\)/i);
    fireEvent.click(await screen.findByText('Persona'));

    expect(
      await screen.findByText(/Row 1 → “Persona” \(1966\), replacing “Persona3 the Movie #4 Winter of Rebirth”/i),
    ).toBeTruthy();
  });
});

describe('builder — a wrong-type match is never attached in the first place', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockRejectedValue(new Error('no search'));
  });

  it('leaves the row unresolved when the matcher returns another type', async () => {
    // The matcher blocks on embeddings, so its nearest neighbour can be a
    // different type entirely — that's how a Movie pitch came to hold a
    // TVSeries. Attaching it and flagging it later produces a row that reads
    // Resolved in green and "wrong type" in red at once, and blocks the save
    // from a state the operator never chose.
    client.post.mockImplementation(url =>
      url === '/imports/parse'
        ? Promise.resolve({ data: { candidates: [{ position: 0, raw_text: 'Persona (1966)', inferred_type: null }] } })
        : Promise.resolve({
            data: {
              results: [
                {
                  index: 0,
                  status: 'found_existing',
                  confidence: 0.62,
                  match: { thing_id: 'tvseries_hignfy_1990', title: 'Have I Got News for You', type: 'TVSeries', year: 1990 },
                  suggestions: [],
                },
              ],
            },
          }),
    );

    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={[]} />);
    fireEvent.change(document.querySelector('textarea'), { target: { value: 'Persona (1966)' } });
    fireEvent.click(screen.getByRole('button', { name: /parse & resolve/i }));

    expect(await screen.findByText(/matched to something that isn't Movie/i)).toBeTruthy();
    // Unresolved, not "Resolved + wrong type".
    expect(screen.getAllByText('Unresolved').length).toBeGreaterThan(0);
    expect(screen.queryByText('wrong type')).toBeNull();
    expect(screen.getByRole('button', { name: /save items/i }).disabled).toBe(false);
  });
});

describe('builder — the save guard is on the operation, not the button', () => {
  const POISONED = [
    {
      raw_text: 'Persona (1966) 🇸🇪 8.6/10',
      thing_id: 'tvseries_hignfy_1990',
      resolution_status: 'resolved',
      position: 0,
      thing_type_actual: 'TVSeries',
      thing_metadata: { title: 'Have I Got News for You', year: 1990 },
    },
  ];

  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.put.mockReset();
    client.get.mockRejectedValue(new Error('no search'));
    client.put.mockResolvedValue({ data: { success: true, item_count: 1 } });
  });

  it('refuses the `s` shortcut too, which is how the mismatch got saved', () => {
    // The button was disabled and the keypath called save() directly. The API
    // validates nothing on PUT items, so the UI check is the only one there is
    // — which makes "guard the button" not a guard at all.
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={POISONED} />);
    expect(screen.getByRole('button', { name: /save items/i }).disabled).toBe(true);

    fireEvent.keyDown(window, { key: 's' });

    expect(client.put).not.toHaveBeenCalled();
    expect(screen.getByText(/Not saved — row 1 is not Movie/i)).toBeTruthy();
  });

  it('still saves by shortcut when nothing is mismatched', async () => {
    const clean = [{ ...POISONED[0], thing_id: 'movie_persona_1966_aa', thing_type_actual: 'Movie', thing_metadata: { title: 'Persona', year: 1966 } }];
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={clean} />);

    fireEvent.keyDown(window, { key: 's' });

    await vi.waitFor(() => expect(client.put).toHaveBeenCalledWith('/pitches/p_1/items', expect.anything()));
  });
});

describe('builder — a lagging refetch must not undo the operator', () => {
  // Saving invalidates the pitch query, and GET /pitches/:id reads a replica.
  // The refetch can return the rows as they were BEFORE the write; adopting
  // those reverted the edit that had just been saved, and saving again wrote
  // the stale copy back. A fix that undoes itself.
  const STALE = [{
    raw_text: 'Persona (1966)',
    thing_id: 'tvseries_hignfy_1990',
    resolution_status: 'resolved',
    position: 0,
    thing_type_actual: 'TVSeries',
    thing_metadata: { title: 'Have I Got News for You', year: 1990 },
  }];

  function Harness() {
    // Mirrors PitchDetailPage: `items` changes identity when the query refetches.
    const [items, setItems] = useState(STALE);
    return (
      <>
        <button onClick={() => setItems([...STALE])}>refetch stale</button>
        <PitchBuilder pitchId="p_1" thingType="Movie" items={items} />
      </>
    );
  }

  beforeEach(() => {
    client.get.mockReset();
    client.put.mockReset();
    client.get.mockResolvedValue({
      data: { results: [{ thing_id: 'movie_persona_1966_aa', title: 'Persona', type: 'Movie', year: 1966, source: 'local', in_registry: true }] },
    });
    client.put.mockResolvedValue({ data: { success: true, item_count: 1 } });
  });

  it('keeps the picked match when the server echoes the old rows back', async () => {
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByText('Persona'));
    await screen.findByText(/Row 1 → “Persona”/);

    // The replica hands back the pre-write rows.
    fireEvent.click(screen.getByRole('button', { name: /refetch stale/i }));

    // The edit survives, and the wrong-type block does not return.
    expect(screen.queryByText('wrong type')).toBeNull();
    expect(screen.getByRole('button', { name: /save items/i }).disabled).toBe(false);
    expect(screen.getByText(/stored item set changed while you were working/i)).toBeTruthy();
  });
});

describe('builder — an unsaved build survives a reload', () => {
  const PASTED = [
    { raw_text: 'Persona (1966)', thing_id: 'movie_persona_1966_aa', status: 'resolved', candidates: [], match: { title: 'Persona', type: 'Movie', year: 1966 }, note: '', dropped: false, confidence: 1, reason: null },
  ];

  beforeEach(() => {
    client.get.mockReset();
    client.put.mockReset();
    client.get.mockRejectedValue(new Error('no search'));
    client.put.mockResolvedValue({ data: { success: true, item_count: 1 } });
  });

  it('restores the rows and says so', () => {
    // Losing one was silent and total: the pitch looked untouched and every
    // adjudication since the paste was gone.
    sessionStorage.setItem('pitchDraft:p_1', JSON.stringify({ v: 1, savedAt: Date.now(), rows: PASTED }));
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={[]} />);

    // Appears in the table and again in the focused-row editor header.
    expect(screen.getAllByText('Persona (1966)').length).toBeGreaterThan(0);
    expect(screen.getByText(/Unsaved work restored/i)).toBeTruthy();
    // Restored work counts as unsaved, so Save is live.
    expect(screen.getByRole('button', { name: /save items/i }).disabled).toBe(false);
  });

  it('keeps the draft out of the way once the pitch holds it', async () => {
    sessionStorage.setItem('pitchDraft:p_1', JSON.stringify({ v: 1, savedAt: Date.now(), rows: PASTED }));
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /save items/i }));

    await vi.waitFor(() => expect(client.put).toHaveBeenCalled());
    await vi.waitFor(() => expect(sessionStorage.getItem('pitchDraft:p_1')).toBeNull());
  });

  it('does not restore one pitch draft onto another', () => {
    sessionStorage.setItem('pitchDraft:p_OTHER', JSON.stringify({ v: 1, savedAt: Date.now(), rows: PASTED }));
    renderWithProviders(<PitchBuilder pitchId="p_1" thingType="Movie" items={[]} />);
    expect(screen.queryByText('Persona (1966)')).toBeNull();
  });
});
