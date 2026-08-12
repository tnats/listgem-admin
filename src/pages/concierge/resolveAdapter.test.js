import { describe, expect, it } from 'vitest';
import {
  BATCH_LIMIT,
  applyBatchResults,
  batchResults,
  chunkForBatch,
  normalizeParsed,
  normalizeResolution,
  pendingIndices,
  rowsFromItems,
  rowsFromParsed,
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
    expect(res.status).toBe('unresolved');
    expect(res.thing_id).toBeNull();
    expect(res.candidates).toHaveLength(1);
    expect(res.reason).toBe('no_confident_match');
  });

  it('maps the batch envelope back onto rows', () => {
    const rows = rowsFromParsed(normalizeParsed(['The Matrix', 'zzzz nonsense qqq']));
    const next = applyBatchResults(rows, batchResults({ results: [PROD_FOUND, PROD_NO_MATCH], count: 2 }), [0, 1]);
    expect(next.map(r => r.status)).toEqual(['resolved', 'unresolved']);
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

  it('builds /resolve/batch candidates with a type on every row', () => {
    // `type` is required per candidate and the parser often sends none, so the
    // pitch's thing_type has to fill in or the whole batch 400s.
    const rows = rowsFromParsed([
      { position: 0, raw_text: 'The Matrix', inferred_type: null },
      { position: 1, raw_text: 'Slow Horses', inferred_type: 'TVSeries' },
    ]);
    expect(toBatchPayload(rows, [0, 1], 'Movie')).toEqual([
      { type: 'Movie', title: 'The Matrix' },
      { type: 'TVSeries', title: 'Slow Horses' },
    ]);
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
  it('splits at the 200-item rate-limit unit', () => {
    const chunks = chunkForBatch([...Array(450).keys()]);
    expect(chunks.map(c => c.length)).toEqual([BATCH_LIMIT, BATCH_LIMIT, 50]);
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
