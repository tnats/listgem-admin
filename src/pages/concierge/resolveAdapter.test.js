import { describe, expect, it } from 'vitest';
import {
  BATCH_LIMIT,
  applyBatchResults,
  batchResults,
  chunkForBatch,
  normalizeParseOutcome,
  normalizeParsed,
  normalizeCandidate,
  normalizeResolution,
  normalizeSearchResults,
  pendingIndices,
  rowsFromItems,
  rowsFromParsed,
  extractYear,
  searchTitle,
  tableQueries,
  queryFor,
  dedupeAgainst,
  duplicateIndices,
  duplicateGroups,
  matchConcern,
  summarize,
  toBatchPayload,
  toItemsPayload,
} from './resolveAdapter';

// Trimmed from real prod responses, 2026-08-12.
const PROD_FOUND = {
  index: 0,
  status: 'found_existing',
  confidence: 1,
  reason: null,
  match: {
    thing_id: 'movie_the_matrix_1999_14aa79a9',
    type: 'Movie',
    parent_type: 'CreativeWork',
    title: 'The Matrix',
    year: '1999',
    image_url: 'https://image.tmdb.org/t/p/w500/x.jpg',
  },
  suggestions: [{ thing_id: 'movie_the_animatrix_2003_8bfc8e62', type: 'Movie', title: 'The Animatrix', year: '2003' }],
};

const PROD_NO_MATCH = {
  index: 1,
  status: 'no_match',
  confidence: null,
  reason: 'no_confident_match',
  match: null,
  suggestions: [{ thing_id: 'movie_xxxxxxxx_2023_5af3c660', type: 'Movie', title: 'Xxxxxxxx', year: '2023' }],
};

describe('the shapes prod actually returns', () => {
  it('reads a found_existing result', () => {
    const res = normalizeResolution(PROD_FOUND);
    expect(res.status).toBe('resolved');
    expect(res.thing_id).toBe('movie_the_matrix_1999_14aa79a9');
    expect(res.match.title).toBe('The Matrix');
    expect(res.confidence).toBe(1);
  });

  it('offers `suggestions` as the alternates list', () => {
    expect(normalizeResolution(PROD_FOUND).candidates.map(c => c.title)).toEqual(['The Animatrix']);
  });

  it('never adopts a lone suggestion on no_match', () => {
    // The server said it could not match this. One suggestion is an option for
    // the operator, not a resolution — adopting it would silently invent a link.
    const res = normalizeResolution(PROD_NO_MATCH);
    expect(res.thing_id).toBeNull();
    expect(res.candidates).toHaveLength(1);
    expect(res.reason).toBe('no_confident_match');
  });

  it('calls a no_match that carries suggestions ambiguous, not unresolved', () => {
    // "Not confident, you pick" is a different instruction from "no such
    // thing", and reporting both as unresolved gave the operator no reason to
    // open the row. Three films in a 40-row build sat as failures with the
    // right match already sitting in their candidate list.
    expect(normalizeResolution(PROD_NO_MATCH).status).toBe('ambiguous');
  });

  it('still calls a no_match with nothing to offer unresolved', () => {
    const res = normalizeResolution({ ...PROD_NO_MATCH, suggestions: [] });
    expect(res.status).toBe('unresolved');
    expect(res.thing_id).toBeNull();
  });

  it('maps the batch envelope back onto rows', () => {
    const rows = rowsFromParsed(normalizeParsed(['The Matrix', 'zzzz nonsense qqq']));
    const next = applyBatchResults(rows, batchResults({ results: [PROD_FOUND, PROD_NO_MATCH], count: 2 }), [0, 1]);
    expect(next.map(r => r.status)).toEqual(['resolved', 'ambiguous']);
  });

  it('parses the real /imports/parse envelope, 0-based positions and all', () => {
    const parsed = normalizeParsed({
      success: true,
      candidates: [
        { position: 0, raw_text: 'The Matrix', inferred_type: null },
        { position: 1, raw_text: 'Inception', inferred_type: 'Movie' },
      ],
      candidate_count: 2,
      method: 'structured',
    });
    expect(parsed.map(p => p.raw_text)).toEqual(['The Matrix', 'Inception']);
    expect(parsed[1].inferred_type).toBe('Movie');
  });

  it('sends the pitch type on every candidate, never a row-derived one', () => {
    // A list holds one type, so there is no legitimate row-level variation —
    // and a row that matched the wrong thing carries that thing's type. Letting
    // that win constrained the search meant to correct it: a Movie pitch whose
    // row had mismatched to a TVSeries searched TMDB's TV index and returned
    // twenty TV results, none of them the film.
    const rows = rowsFromParsed([
      { position: 0, raw_text: 'The Matrix', inferred_type: null },
      { position: 1, raw_text: 'Slow Horses', inferred_type: 'TVSeries' },
    ]);
    expect(toBatchPayload(rows, [0, 1], 'Movie')).toEqual([
      { type: 'Movie', title: 'The Matrix' },
      { type: 'Movie', title: 'Slow Horses' },
    ]);
    // …and the year rides as its own field when the text carries one.
    const dated = rowsFromParsed([{ position: 0, raw_text: 'Arrival (2016)', inferred_type: null }]);
    expect(toBatchPayload(dated, [0], 'Movie')).toEqual([{ type: 'Movie', title: 'Arrival', year: 2016 }]);
  });

  it('a saved row that matched the wrong type does not carry it forward', () => {
    const rows = rowsFromItems([
      { raw_text: 'Persona (1966)', thing_id: 'tvseries_wrong', resolution_status: 'resolved', thing_type_actual: 'TVSeries' },
    ]);
    expect(toBatchPayload(rows, [0], 'Movie')).toEqual([{ type: 'Movie', title: 'Persona', year: 1966 }]);
  });
});

describe('normalizeResolution', () => {
  it('takes the server status when it sends one', () => {
    expect(normalizeResolution({ status: 'pending' }).status).toBe('pending');
    expect(normalizeResolution({ status: 'ambiguous', candidates: [{ thing_id: 'a' }, { thing_id: 'b' }] }).status)
      .toBe('ambiguous');
  });

  it('derives a status when the server omits one', () => {
    expect(normalizeResolution({ thing_id: 'thing_1' }).status).toBe('resolved');
    expect(normalizeResolution({ candidates: [{ thing_id: 'a' }, { thing_id: 'b' }] }).status).toBe('ambiguous');
    expect(normalizeResolution({}).status).toBe('unresolved');
  });

  it('never calls a row resolved without a thing_id', () => {
    expect(normalizeResolution({ status: 'resolved' }).status).toBe('unresolved');
    expect(normalizeResolution({ status: 'resolved', candidates: [{ thing_id: 'a' }, { thing_id: 'b' }] }).status)
      .toBe('ambiguous');
  });

  it('promotes a lone candidate to the match', () => {
    const res = normalizeResolution({ candidates: [{ thing_id: 'thing_9', title: 'Dune' }] });
    expect(res.thing_id).toBe('thing_9');
    expect(res.status).toBe('resolved');
    expect(res.match.title).toBe('Dune');
  });

  it('reads candidates from whichever key the endpoint uses', () => {
    expect(normalizeResolution({ matches: [{ thing_id: 'a' }] }).thing_id).toBe('a');
    expect(normalizeResolution({ results: [{ thing_id: 'b' }] }).thing_id).toBe('b');
  });

  it('survives junk', () => {
    expect(normalizeResolution(null)).toEqual({
      status: 'unresolved',
      thing_id: null,
      candidates: [],
      match: null,
      confidence: null,
      reason: null,
    });
    expect(normalizeResolution({ candidates: 'nope' }).candidates).toEqual([]);
  });
});

describe('normalizeParsed', () => {
  it('keeps the source ordering', () => {
    const parsed = normalizeParsed({ items: [{ position: 2, raw_text: 'B' }, { position: 1, raw_text: 'A' }] });
    expect(parsed.map(p => p.raw_text)).toEqual(['A', 'B']);
  });

  it('drops blank lines and tolerates bare strings', () => {
    expect(normalizeParsed(['A', '  ', 'B']).map(p => p.raw_text)).toEqual(['A', 'B']);
  });
});

describe('batching', () => {
  it('splits at the rate-limit unit', () => {
    const chunks = chunkForBatch([...Array(250).keys()]);
    expect(chunks.map(c => c.length)).toEqual([BATCH_LIMIT, BATCH_LIMIT, 50]);
  });

  it('keeps a full chunk clear of the server deadline', () => {
    // ~0.25s an item measured against prod, against a 60s server deadline.
    expect(BATCH_LIMIT * 0.25).toBeLessThan(40);
  });

  it('sends a batch payload in the order the indices were given', () => {
    const rows = rowsFromParsed(normalizeParsed(['A', 'B', 'C']));
    expect(toBatchPayload(rows, [2, 0], 'Movie')).toEqual([
      { type: 'Movie', title: 'C' },
      { type: 'Movie', title: 'A' },
    ]);
  });

  it('unwraps whichever container the batch response uses', () => {
    expect(batchResults([{ index: 0 }])).toHaveLength(1);
    expect(batchResults({ results: [{ index: 0 }] })).toHaveLength(1);
    expect(batchResults({ items: [{ index: 0 }] })).toHaveLength(1);
    expect(batchResults({ nope: 1 })).toEqual([]);
  });

  it('maps scattered results back onto their original rows', () => {
    const rows = rowsFromParsed(normalizeParsed(['A', 'B', 'C', 'D']));
    // Re-checking rows 1 and 3 only: batch index 0 → row 1, batch index 1 → row 3.
    const next = applyBatchResults(rows, [
      { index: 1, thing_id: 'thing_d' },
      { index: 0, thing_id: 'thing_b' },
    ], [1, 3]);
    expect(next.map(r => r.thing_id)).toEqual([null, 'thing_b', null, 'thing_d']);
    expect(next[0].status).toBe('unresolved');
  });

  it('ignores results with no index', () => {
    const rows = rowsFromParsed(normalizeParsed(['A']));
    expect(applyBatchResults(rows, [{ thing_id: 'x' }], [0])[0].thing_id).toBeNull();
  });
});

describe('pending rows', () => {
  it('reports pending indices so they can be re-requested, not written off', () => {
    const rows = [{ status: 'resolved' }, { status: 'pending' }, { status: 'unresolved' }, { status: 'pending' }];
    expect(pendingIndices(rows)).toEqual([1, 3]);
  });

  it('counts pending separately from unresolved', () => {
    const counts = summarize([{ status: 'pending' }, { status: 'unresolved' }]);
    expect(counts.pending).toBe(1);
    expect(counts.unresolved).toBe(1);
  });
});

describe('toItemsPayload', () => {
  const rows = [
    { raw_text: ' The Matrix ', thing_id: 'thing_matrix', status: 'resolved', note: '' },
    { raw_text: 'Jar City', thing_id: null, status: 'ambiguous', note: ' two cuts ' },
    { raw_text: 'Dropped', thing_id: 'thing_x', status: 'resolved', dropped: true },
    { raw_text: '   ', thing_id: null, status: 'unresolved' },
  ];

  it('replaces the whole set in builder order, minus drops and blanks', () => {
    expect(toItemsPayload(rows).map(i => i.raw_text)).toEqual(['The Matrix', 'Jar City']);
  });

  it('only ever sends resolved or ambiguous, and never resolved without a thing_id', () => {
    for (const item of toItemsPayload(rows)) {
      expect(['resolved', 'ambiguous']).toContain(item.resolution_status);
      if (item.resolution_status === 'resolved') expect(item.thing_id).toBeTruthy();
    }
  });

  it('normalises notes to null rather than empty strings', () => {
    const [matrix, jarCity] = toItemsPayload(rows);
    expect(matrix.note).toBeNull();
    expect(jarCity.note).toBe('two cuts');
  });
});

describe('rowsFromItems', () => {
  it('round-trips a saved item set back into the builder', () => {
    const rows = rowsFromItems([
      { raw_text: 'A', thing_id: 'thing_a', resolution_status: 'resolved' },
      { raw_text: 'B', thing_id: null, resolution_status: 'unresolved' },
    ]);
    expect(rows.map(r => r.status)).toEqual(['resolved', 'unresolved']);
    expect(rows.every(r => r.dropped === false)).toBe(true);
  });

  it('reads the title out of thing_metadata, where saved items keep it', () => {
    // Real GET /pitches/:id item: no nested `thing`, no top-level title.
    const [row] = rowsFromItems([
      {
        pitch_item_id: 7,
        position: 0,
        thing_id: 'movie_just_like_heaven_2005_02a65a22',
        raw_text: 'Resolved item',
        resolution_status: 'resolved',
        note: null,
        thing_type_actual: 'Movie',
        thing_metadata: { year: '2005', title: 'Just Like Heaven', tmdb_id: 9007 },
      },
    ]);
    expect(row.match.title).toBe('Just Like Heaven');
    expect(row.match.year).toBe('2005');
    expect(row.match.type).toBe('Movie');
  });

  it('orders by position, not by array order', () => {
    const rows = rowsFromItems([
      { position: 2, raw_text: 'third' },
      { position: 0, raw_text: 'first' },
      { position: 1, raw_text: 'second' },
    ]);
    expect(rows.map(r => r.raw_text)).toEqual(['first', 'second', 'third']);
  });

  it('handles a pitch with no items', () => {
    expect(rowsFromItems(undefined)).toEqual([]);
  });
});

describe('federated search results (GET /search-to-add)', () => {
  // Trimmed from the real shape: registry hits carry a thing_id and sort first,
  // external hits carry source/source_id and in_registry: false.
  const RESULTS = {
    results: [
      {
        thing_id: 'movie_the_matrix_1999_14aa79a9',
        type: 'Movie',
        title: 'The Matrix',
        subtitle: 'Lana Wachowski',
        year: 1999,
        source: 'local',
        source_id: null,
        in_registry: true,
      },
      {
        thing_id: null,
        type: 'Movie',
        title: 'The Matrix Resurrections',
        subtitle: null,
        year: 2021,
        source: 'tmdb',
        source_id: 624860,
        in_registry: false,
      },
    ],
    count: 2,
    sources_searched: ['local', 'tmdb_movie'],
  };

  it('reads registry and external hits, keeping them distinguishable', () => {
    const [registry, external] = normalizeSearchResults(RESULTS);
    expect(registry.thing_id).toBe('movie_the_matrix_1999_14aa79a9');
    expect(registry.in_registry).toBe(true);
    expect(external.thing_id).toBeNull();
    expect(external.in_registry).toBe(false);
    expect(external.source).toBe('tmdb');
  });

  it('takes the creator from `subtitle`, where this endpoint puts it', () => {
    expect(normalizeSearchResults(RESULTS)[0].creator).toBe('Lana Wachowski');
  });

  it('survives an empty or malformed response', () => {
    expect(normalizeSearchResults({ results: [] })).toEqual([]);
    expect(normalizeSearchResults(null)).toEqual([]);
    expect(normalizeSearchResults({ results: 'nope' })).toEqual([]);
  });

  it('still marks /resolve suggestions as in-registry — they are graph neighbours', () => {
    // /resolve never sends in_registry; anything it returns with a thing_id is
    // by definition already in the graph.
    const res = normalizeResolution({ status: 'no_match', suggestions: [{ thing_id: 'thing_a', title: 'A' }] });
    expect(res.candidates[0].in_registry).toBe(true);
  });
});

describe('searchTitle — list decoration wrecks the match', () => {
  // Real rows from a Nordic-noir source list. Sending the whole string as the
  // title collapsed the trigram similarity, widened the vector distance, and
  // filterSuggestions then dropped the alternates too — so a wrong match
  // arrived with nothing to correct it.
  it('strips ratings, flags and the year, leaving a bare title', () => {
    // Registry titles are bare, and TMDB's search doesn't parse "(1966)" — it
    // matched nothing at all for Persona. The year travels as its own field.
    expect(searchTitle('Persona (1966) 🇸🇪 8.6/10')).toBe('Persona');
    expect(searchTitle('Fanny & Alexander (1982) 🇸🇪 9.1/10')).toBe('Fanny & Alexander');
    expect(searchTitle('The Hunt (2012) 🇩🇰 8.5/10')).toBe('The Hunt');
    expect(searchTitle('The Emigrants + The New Land (1971, 1972)')).toBe('The Emigrants + The New Land');
  });

  it('pulls the year out separately', () => {
    expect(extractYear('Persona (1966) 🇸🇪 8.6/10')).toBe(1966);
    expect(extractYear('The Emigrants + The New Land (1971, 1972)')).toBe(1971);
    expect(extractYear('The Matrix')).toBeNull();
  });

  it('strips leading list decoration the parser leaves behind', () => {
    expect(searchTitle('1. The Celebration (1998)')).toBe('The Celebration');
    expect(searchTitle('— Let the Right One In')).toBe('Let the Right One In');
    expect(searchTitle('• Insomnia')).toBe('Insomnia');
  });

  it('handles other rating notations', () => {
    expect(searchTitle('Dune 4/5')).toBe('Dune');
    expect(searchTitle('Sapiens 92%')).toBe('Sapiens');
  });

  it('leaves a clean title alone', () => {
    expect(searchTitle('The Matrix')).toBe('The Matrix');
    expect(searchTitle('The Matrix Reloaded')).toBe('The Matrix Reloaded');
  });

  it('never returns junk for junk', () => {
    expect(searchTitle('')).toBe('');
    expect(searchTitle('   🇸🇪  8.6/10 ')).toBe('');
  });

  it('is what the batch payload sends, while raw_text is preserved', () => {
    const rows = rowsFromParsed([{ position: 0, raw_text: 'Persona (1966) 🇸🇪 8.6/10', inferred_type: null }]);
    expect(toBatchPayload(rows, [0], 'Movie')).toEqual([{ type: 'Movie', title: 'Persona', year: 1966 }]);
    // The operator still sees what they pasted, and so does the target.
    expect(rows[0].raw_text).toBe('Persona (1966) 🇸🇪 8.6/10');
  });
});

describe('normalizeParseOutcome — a clipped paste must not look complete', () => {
  it('reports truncation and the cap', () => {
    // /imports/parse caps input at max_input_chars and sets truncated when it
    // clips. Dropping that left the operator with a plausible list of rows and
    // no sign the tail never arrived.
    const out = normalizeParseOutcome({
      success: true,
      candidates: [{ position: 0, raw_text: 'The Exorcist (1973)', inferred_type: null }],
      candidate_count: 1,
      method: 'structured',
      truncated: true,
      max_input_chars: 20000,
    });
    expect(out.truncated).toBe(true);
    expect(out.maxInputChars).toBe(20000);
    expect(out.method).toBe('structured');
    expect(out.candidates).toHaveLength(1);
  });

  it('is quiet when nothing was clipped', () => {
    const out = normalizeParseOutcome({ candidates: [], truncated: false, max_input_chars: 20000 });
    expect(out.truncated).toBe(false);
  });

  it('treats a missing flag as not truncated, not as unknown', () => {
    // A parser that says nothing has not said it clipped; don't invent a warning.
    expect(normalizeParseOutcome({ candidates: [] }).truncated).toBe(false);
    expect(normalizeParseOutcome(null).truncated).toBe(false);
  });
});

describe('tableQueries — a pasted table, read as a block', () => {
  // Verbatim from the run that sent all 41 of these to the matcher as titles.
  const HORROR = [
    'Rank Film Year Worldwide gross Ref',
    '1 It 2017 $719,766,009 [1][2]',
    '2 The Sixth Sense 1999 $672,806,292 [3][4]',
    '3 I Am Legend 2007 $585,532,684 [5][6]',
    '4 World War Z 2013 $540,007,876 [7][8]',
    '5 Obsession \u2020 2026 $501,596,715 [9][10]',
    '6 The Conjuring: Last Rites 2025 $499,256,445 [11][12]',
    '11 Signs 2002 $408,250,578 [21][22]',
    '39 The Ring 2002 $249,348,933 [77][78]',
  ];

  it('asks for the title, not the whole row', () => {
    const q = tableQueries(HORROR);
    expect(q.map(r => r.title)).toEqual([
      'Rank Film Year Worldwide gross Ref',
      'It',
      'The Sixth Sense',
      'I Am Legend',
      'World War Z',
      'Obsession',
      'The Conjuring: Last Rites',
      'Signs',
      'The Ring',
    ]);
  });

  it('reads the year column as the year', () => {
    expect(tableQueries(HORROR).map(r => r.year)).toEqual([
      null, 2017, 1999, 2007, 2013, 2026, 2025, 2002, 2002,
    ]);
  });

  it('marks the heading row, and nothing else', () => {
    const q = tableQueries(HORROR);
    expect(q[0].header).toBe(true);
    expect(q.slice(1).every(r => r.header === false)).toBe(true);
  });

  it('keeps a number that is part of the title', () => {
    // No rank column here: the leading integers do not count up.
    const titles = tableQueries(['28 Days Later', '12 Angry Men', '300', '1917']).map(r => r.title);
    expect(titles).toEqual(['28 Days Later', '12 Angry Men', '300', '1917']);
  });

  it('keeps a year that is part of the title', () => {
    // Two years on the row: the column is the trailing one.
    const [q] = tableQueries([
      '17 Blade Runner 2049 2017 $259,239,658 [1]',
      '18 Alien 1979 $203,630,630 [2]',
      '19 Arrival 2016 $203,388,186 [3]',
    ]);
    expect(q.title).toBe('Blade Runner 2049');
    expect(q.year).toBe(2017);
  });

  it('leaves a plain list alone', () => {
    // "Blade Runner 2049" outside a table is a name, not a name and a year.
    expect(tableQueries(['Blade Runner 2049', 'Arrival', 'Dune']).map(r => r.title)).toEqual([
      'Blade Runner 2049', 'Arrival', 'Dune',
    ]);
  });

  it('handles an empty block', () => {
    expect(tableQueries([])).toEqual([]);
    expect(tableQueries(['', '  '])).toEqual([
      { title: '', year: null, header: false },
      { title: '', year: null, header: false },
    ]);
  });
});

describe('queryFor', () => {
  const row = raw => ({ raw_text: raw, thing_id: null, status: 'unresolved', candidates: [], match: null, note: '', dropped: false, confidence: null, reason: null });

  it('uses what the block-aware pass worked out', () => {
    expect(queryFor({ ...row('1 It 2017 $719,766,009 [1][2]'), query: { title: 'It', year: 2017, header: false } }))
      .toEqual({ title: 'It', year: 2017, header: false });
  });

  it('falls back to the row alone for a link or a catalogue pick', () => {
    expect(queryFor(row('Persona (1966)'))).toEqual({ title: 'Persona', year: 1966, header: false });
  });
});

describe('duplicates', () => {
  const row = (raw, thingId = null) => ({
    raw_text: raw, thing_id: thingId, status: thingId ? 'resolved' : 'unresolved',
    candidates: [], match: null, note: '', dropped: false, confidence: null, reason: null,
  });

  it('skips a re-paste of lines already on the list', () => {
    // The builder keeps unsaved work now, so pasting again lands on rows that
    // are already there: a 40-film list became 82 rows.
    const existing = [row('1 It 2017 $719,766,009 [1][2]'), row('2 The Sixth Sense 1999 $672,806,292 [3][4]')];
    const { rows, skipped } = dedupeAgainst(existing, [
      row('1 It 2017 $719,766,009 [1][2]'),
      row('  2 THE SIXTH SENSE 1999 $672,806,292 [3][4] '),
      row('3 I Am Legend 2007 $585,532,684 [5][6]'),
    ]);
    expect(skipped).toBe(2);
    expect(rows.map(r => r.raw_text)).toEqual(['3 I Am Legend 2007 $585,532,684 [5][6]']);
  });

  it('does not treat a dropped row as occupying the list', () => {
    const existing = [{ ...row('Jaws'), dropped: true }];
    expect(dedupeAgainst(existing, [row('Jaws')]).skipped).toBe(0);
  });

  it('catches two different lines that resolved to one film', () => {
    const rows = [row('Alien', 'movie_alien_1979'), row('Alien (1979)', 'movie_alien_1979'), row('Jaws', 'movie_jaws_1975')];
    // The first of each is kept; only the repeat is reported.
    expect(duplicateIndices(rows)).toEqual([1]);
  });

  it('does not call two unresolved rows duplicates of each other', () => {
    expect(duplicateIndices([row('Obsession'), row('Obsession')])).toEqual([]);
  });

  it('ignores a dropped repeat', () => {
    const rows = [row('Alien', 'movie_alien_1979'), { ...row('Alien', 'movie_alien_1979'), dropped: true }];
    expect(duplicateIndices(rows)).toEqual([]);
  });
});

describe('duplicateGroups — which row is wrong is not ours to decide', () => {
  const row = (raw, thingId, title) => ({
    raw_text: raw, thing_id: thingId, status: thingId ? 'resolved' : 'unresolved',
    candidates: [], match: thingId ? { title, type: 'Movie', year: null } : null,
    note: '', dropped: false, confidence: null, reason: null,
  });

  it('reports every row in the group and what they landed on', () => {
    // Row 17 mis-picked and collided with row 31, the correct one. Reporting
    // only 31 sent the operator to delete the right film.
    const rows = [
      row('16 Hannibal 2001', 'movie_the_silence_of_the_lambs_1991', 'The Silence of the Lambs'),
      row('17 Alien: Romulus 2024', 'movie_alien_romulus_2024', 'Alien: Romulus'),
      row('30 The Silence of the Lambs 1991', 'movie_the_silence_of_the_lambs_1991', 'The Silence of the Lambs'),
    ];
    expect(duplicateGroups(rows)).toEqual([
      { thing_id: 'movie_the_silence_of_the_lambs_1991', title: 'The Silence of the Lambs', indices: [0, 2] },
    ]);
  });

  it('still knows which are the repeats', () => {
    const rows = [
      row('a', 'movie_x', 'X'), row('b', 'movie_x', 'X'), row('c', 'movie_x', 'X'), row('d', 'movie_y', 'Y'),
    ];
    expect(duplicateIndices(rows)).toEqual([1, 2]);
  });

  it('reports nothing when every row is its own film', () => {
    expect(duplicateGroups([row('a', 'movie_x', 'X'), row('b', 'movie_y', 'Y')])).toEqual([]);
  });
});

describe('matchConcern — a match that agrees with nothing', () => {
  // Rows must come from a real block paste, or queryFor falls back to the
  // per-row cleaner and the comparison is made against a string production
  // never sees — which would let a broken cleaner pass this suite.
  const BLOCK = [
    '1 It 2017 $719,766,009 [1][2]',
    '7 Jaws 1975 $495,201,848 [13][14]',
    '8 It Chapter Two 2019 $473,123,154 [15][16]',
    '16 Hannibal 2001 $351,692,268 [31][32]',
    '19 The Conjuring 2 2016 $322,811,702 [37][38]',
    '20 The Conjuring 2013 $320,415,166 [39][40]',
    '26 A Quiet Place Part II 2020 $297,372,261 [51][52]',
    '27 Five Nights at Freddy\u2019s 2023 $297,144,130 [53][54]',
    '30 The Silence of the Lambs 1991 $275,726,716 [59][60]',
    '33 A Quiet Place: Day One 2024 $261,907,653 [65][66]',
    '37 Us 2019 $256,071,218 [73][74]',
    '5 Obsession \u2020 2026 $501,596,715 [9][10]',
  ];
  const built = rowsFromParsed(normalizeParsed(BLOCK));
  const at = raw => built[BLOCK.indexOf(raw)];
  const paste = raw => at(raw);
  const matched = (raw, title, year) => ({
    ...at(raw),
    thing_id: 'movie_x',
    status: 'resolved',
    match: { title, type: 'Movie', year },
  });

  it('is comparing against the cleaned title, not the pasted line', () => {
    expect(queryFor(at('16 Hannibal 2001 $351,692,268 [31][32]'))).toEqual({
      title: 'Hannibal', year: 2001, header: false,
    });
  });

  it('flags the one that went wrong in production', () => {
    // The matcher offered The Silence of the Lambs as its only suggestion for
    // Hannibal, so the operator picked the one thing on offer. Different name,
    // ten years out — the row knew both.
    const why = matchConcern(matched('16 Hannibal 2001 $351,692,268 [31][32]', 'The Silence of the Lambs', 1991));
    expect(why).toMatch(/The Silence of the Lambs/);
    expect(why).toMatch(/2001.*1991/);
  });

  it('accepts the drift the server itself tolerates', () => {
    // Real match from the same run: the table dates it 2020, the registry 2021.
    const row = '26 A Quiet Place Part II 2020 $297,372,261 [51][52]';
    expect(matchConcern(matched(row, 'A Quiet Place Part II', 2021))).toBeNull();
    // Two years is the window the server's suggestion filter keeps
    // (listgem-platform#564); flagging inside it would only contradict it.
    expect(matchConcern(matched(row, 'A Quiet Place Part II', 2022))).toBeNull();
    expect(matchConcern(matched(row, 'A Quiet Place Part II', 2018))).toBeNull();
  });

  it('still catches the gap a franchise sibling opens', () => {
    // 15 years, the Resident Evil mis-pick; 10, the Hannibal one.
    expect(matchConcern(matched('26 A Quiet Place Part II 2020 $297,372,261 [51][52]', 'A Quiet Place', 2023)))
      .toMatch(/2020.*2023/);
  });

  it('accepts a sequel or a re-pointed title that still shares the name', () => {
    expect(matchConcern(matched('19 The Conjuring 2 2016 $322,811,702 [37][38]', 'The Conjuring 2', 2016))).toBeNull();
    expect(matchConcern(matched('8 It Chapter Two 2019 $473,123,154 [15][16]', 'It Chapter Two', 2019))).toBeNull();
  });

  it('says nothing about a row that has not resolved', () => {
    expect(matchConcern(paste('16 Hannibal 2001 $351,692,268 [31][32]'))).toBeNull();
  });

  it('leaves the whole clean run clean', () => {
    // Every resolved row from the 40-film build. One false positive here would
    // be an amber warning on a correct match, which teaches operators to skip
    // the warnings.
    const clean = [
      ['1 It 2017 $719,766,009 [1][2]', 'It', 2017],
      ['7 Jaws 1975 $495,201,848 [13][14]', 'Jaws', 1975],
      ['20 The Conjuring 2013 $320,415,166 [39][40]', 'The Conjuring', 2013],
      ['27 Five Nights at Freddy’s 2023 $297,144,130 [53][54]', "Five Nights at Freddy's", 2023],
      ['30 The Silence of the Lambs 1991 $275,726,716 [59][60]', 'The Silence of the Lambs', 1991],
      ['33 A Quiet Place: Day One 2024 $261,907,653 [65][66]', 'A Quiet Place: Day One', 2024],
      ['37 Us 2019 $256,071,218 [73][74]', 'Us', 2019],
      ['5 Obsession † 2026 $501,596,715 [9][10]', 'Obsession', 2026],
    ];
    // "The Conjuring" is a substring of "The Conjuring 2": the pair has to stay
    // clean in both directions, or a franchise flags itself.
    expect(matchConcern(matched(BLOCK[5], 'The Conjuring', 2013))).toBeNull();
    for (const [raw, title, year] of clean) {
      expect(matchConcern(matched(raw, title, year)), raw).toBeNull();
    }
  });
});

describe('tableQueries — a table the operator re-sorted', () => {
  it('still reads the ranks when the order is scrambled', () => {
    // Sorted by year, so the rank column runs 30, 7, 1 — no less a rank column.
    const q = tableQueries([
      '30 The Silence of the Lambs 1991 $275,726,716 [59][60]',
      '7 Jaws 1975 $495,201,848 [13][14]',
      '1 It 2017 $719,766,009 [1][2]',
    ]);
    expect(q.map(r => r.title)).toEqual(['The Silence of the Lambs', 'Jaws', 'It']);
  });

  it('does not invent a rank column for number-titled films', () => {
    // Descending, and no money or reference columns to corroborate.
    expect(tableQueries(['300 Rise of an Empire', '28 Days Later', '12 Monkeys']).map(r => r.title))
      .toEqual(['300 Rise of an Empire', '28 Days Later', '12 Monkeys']);
  });
});

describe('matchConcern — a missing year is not a disagreement', () => {
  const BLOCK = [
    '16 Hannibal 2001 $351,692,268 [31][32]',
    '7 Jaws 1975 $495,201,848 [13][14]',
    '1 It 2017 $719,766,009 [1][2]',
  ];
  const built = rowsFromParsed(normalizeParsed(BLOCK));
  const withMatchYear = year => ({
    ...built[0],
    thing_id: 'movie_x',
    status: 'resolved',
    match: { title: 'Hannibal', type: 'Movie', year },
  });

  // The server keeps a suggestion when the year is supplied but the candidate
  // has none (listgem-platform#563). Number(null) and Number('') are 0, and 0
  // is finite, so the naive check called that a 2001-year disagreement.
  it.each([null, undefined, '', 'unknown'])('says nothing when the match year is %p', year => {
    expect(matchConcern(withMatchYear(year))).toBeNull();
  });

  it('says nothing when the line carried no year', () => {
    const plain = rowsFromParsed(normalizeParsed(['Hannibal']))[0];
    expect(matchConcern({ ...plain, thing_id: 'movie_x', status: 'resolved', match: { title: 'Hannibal', type: 'Movie', year: 1991 } })).toBeNull();
  });

  it('still speaks when both years are known and far apart', () => {
    expect(matchConcern(withMatchYear(1991))).toMatch(/2001.*1991/);
  });
});

describe('display_text — what the target may be shown', () => {
  it('sends the title we searched on, not the operator notation', () => {
    // The line that exposed this in production, from the invite teaser:
    // "The Emigrants + The New Land (1971, 1972) 🇸🇪 8.6/10"
    const rows = rowsFromParsed(normalizeParsed([
      'The Emigrants + The New Land (1971, 1972) 🇸🇪 8.6/10',
      'Persona (1966) 🇸🇪 8.6/10',
    ]));
    expect(toItemsPayload(rows).map(i => i.display_text)).toEqual([
      'The Emigrants + The New Land',
      'Persona',
    ]);
    // raw_text is untouched — it stays our provenance record.
    expect(toItemsPayload(rows)[0].raw_text).toBe('The Emigrants + The New Land (1971, 1972) 🇸🇪 8.6/10');
  });

  it('strips a pasted table row down to its title', () => {
    const rows = rowsFromParsed(normalizeParsed([
      'Rank Film Year Worldwide gross Ref',
      '22 Resident Evil: The Final Chapter 2017 $314,101,190 [43][44]',
      '23 Annabelle: Creation 2017 $306,592,201 [45][46]',
      '24 Resident Evil: Afterlife 2010 $300,228,084 [47][48]',
    ]));
    // The heading row arrives dropped, so it never reaches the payload.
    expect(toItemsPayload(rows).map(i => i.display_text)).toEqual([
      'Resident Evil: The Final Chapter',
      'Annabelle: Creation',
      'Resident Evil: Afterlife',
    ]);
  });

  it('sends null rather than an empty string when there is nothing to show', () => {
    // The server has no fallback by design; null means "no display line".
    const rows = rowsFromParsed(normalizeParsed(['   🇸🇪  8.6/10 ']));
    expect(toItemsPayload(rows)[0].display_text).toBeNull();
  });

  it('labels resolved rows too, so a row does not depend on staying resolved', () => {
    const rows = rowsFromParsed(normalizeParsed(['Persona (1966)']));
    rows[0].thing_id = 'movie_persona_1966';
    expect(toItemsPayload(rows)[0]).toMatchObject({
      thing_id: 'movie_persona_1966',
      resolution_status: 'resolved',
      display_text: 'Persona',
    });
  });
});

describe('candidate art — where production actually keeps it', () => {
  // Verbatim from GET /things/movie_it_2017_687266e4 on prod, trimmed. Written
  // from the wire rather than by hand: the whole failure is that a hand-written
  // fixture carries whichever field name its author picked, and passes.
  const PROD_THING = {
    thing_id: 'movie_it_2017_687266e4',
    type: 'Movie',
    canonical_ids: { imdb_id: 'tt1396484', tmdb_movie_id: '346364' },
    image_url: null,
    metadata: {
      year: '2017',
      title: 'It',
      rating: 7.241,
      source: 'tmdb_api',
      poster_url: 'https://image.tmdb.org/t/p/w500/9E2y5Q7WlCVNEhP5GiVTjhEhx1o.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w500/qVGpxnjrGlHaSTCqTQI6viBDSfp.jpg',
    },
  };

  it('finds the poster where prod keeps it, not where the field is named', () => {
    // Every Movie thing: image_url null, metadata.poster_url populated.
    expect(normalizeCandidate(PROD_THING).image_url)
      .toBe('https://image.tmdb.org/t/p/w500/9E2y5Q7WlCVNEhP5GiVTjhEhx1o.jpg');
  });

  it('prefers a top-level image_url when the endpoint supplies one', () => {
    // The preview endpoint transforms items and does set it.
    const transformed = { ...PROD_THING, image_url: 'https://cdn/transformed.jpg' };
    expect(normalizeCandidate(transformed).image_url).toBe('https://cdn/transformed.jpg');
  });

  it('takes metadata.image as the last of the chain', () => {
    expect(normalizeCandidate({ thing_id: 't', title: 'X', metadata: { image: 'https://cdn/i.jpg' } }).image_url)
      .toBe('https://cdn/i.jpg');
  });

  it('reports null rather than guessing when there is no art', () => {
    expect(normalizeCandidate({ thing_id: 't', title: 'X', metadata: { backdrop_url: 'https://cdn/b.jpg' } }).image_url)
      .toBeNull();
  });
});
