// Seeded sample for the search-quality inspector (#406), shaped like
// GET /search/hybrid. _fusion carries the per-result lexical_rank / vector_rank
// that drives the lexical-vs-hybrid A/B. Replaced by live results when reachable.
export const MOCK_HYBRID = {
  mode: 'hybrid',
  query: 'dune',
  count: 7,
  results: [
    { thing_id: 't-d1', display_name: 'Dune', type: 'book', _fusion: { rrf: 0.0312, lexical_rank: 1, vector_rank: 2 } },
    { thing_id: 't-d2', display_name: 'Dune Messiah', type: 'book', _fusion: { rrf: 0.0301, lexical_rank: 2, vector_rank: 4 } },
    { thing_id: 't-d3', display_name: 'Dune (2021 film)', type: 'movie', _fusion: { rrf: 0.0288, lexical_rank: 3, vector_rank: 7 } },
    { thing_id: 't-d4', display_name: 'Children of Dune', type: 'book', _fusion: { rrf: 0.0166, lexical_rank: null, vector_rank: 1 } }, // semantic-only win
    { thing_id: 't-d5', display_name: 'Arrakis: The Dune Encyclopedia', type: 'book', _fusion: { rrf: 0.0161, lexical_rank: 9, vector_rank: 3 } },
    { thing_id: 't-d6', display_name: 'God Emperor of Dune', type: 'book', _fusion: { rrf: 0.0159, lexical_rank: null, vector_rank: 5 } }, // semantic-only win
    { thing_id: 't-d7', display_name: 'The Spice Must Flow', type: 'book', _fusion: { rrf: 0.0142, lexical_rank: 14, vector_rank: 9 } },
  ],
};

// A type-implied query ("Best TV Series") flooded by Person records that match
// transitively via credits — the #429 regression. Used so the type-distribution
// panel demonstrates the Person-dominated case offline (see mockFor).
export const MOCK_TV_SERIES = {
  mode: 'hybrid',
  query: 'best tv series',
  count: 13,
  results: [
    { thing_id: 't-s1', display_name: 'Black Mirror', type: 'TVSeries', _fusion: { rrf: 0.0305, lexical_rank: 1, vector_rank: 2 } },
    { thing_id: 't-s2', display_name: 'Westworld', type: 'TVSeries', _fusion: { rrf: 0.0291, lexical_rank: 2, vector_rank: 6 } },
    { thing_id: 't-p1', display_name: 'Ed Speleers', type: 'Person', _fusion: { rrf: 0.0270, lexical_rank: 3, vector_rank: null } },
    { thing_id: 't-s3', display_name: 'Humans', type: 'TVSeries', _fusion: { rrf: 0.0262, lexical_rank: 4, vector_rank: 8 } },
    { thing_id: 't-p2', display_name: 'Şükrü Özyıldız', type: 'Person', _fusion: { rrf: 0.0244, lexical_rank: 5, vector_rank: null } },
    { thing_id: 't-s4', display_name: 'Arrested Development', type: 'TVSeries', _fusion: { rrf: 0.0231, lexical_rank: 6, vector_rank: 11 } },
    { thing_id: 't-p3', display_name: 'Carson MacCormac', type: 'Person', _fusion: { rrf: 0.0210, lexical_rank: 7, vector_rank: null } },
    { thing_id: 't-p4', display_name: 'Lauren Tom', type: 'Person', _fusion: { rrf: 0.0198, lexical_rank: 8, vector_rank: null } },
    { thing_id: 't-p5', display_name: 'Michael McDonald', type: 'Person', _fusion: { rrf: 0.0187, lexical_rank: 9, vector_rank: null } },
    { thing_id: 't-p6', display_name: 'Isaac Hempstead Wright', type: 'Person', _fusion: { rrf: 0.0175, lexical_rank: 10, vector_rank: null } },
    { thing_id: 't-sg1', display_name: 'Best (song)', type: 'Song', _fusion: { rrf: 0.0142, lexical_rank: 12, vector_rank: null } },
    { thing_id: 't-b1', display_name: 'Best Buy', type: 'Brand', _fusion: { rrf: 0.0121, lexical_rank: 15, vector_rank: null } },
    { thing_id: 't-p7', display_name: 'Elisabeth Röhm', type: 'Person', _fusion: { rrf: 0.0110, lexical_rank: 18, vector_rank: null } },
  ],
};

// Pick the seeded sample that best illustrates the query: the Person-flooded
// set for type-implied queries ("best tv series", "top movies", …), else dune.
export function mockFor(query) {
  const q = (query || '').toLowerCase();
  const typeImplied = /(tv series|tv shows|\b(best|top)\b.*\b(movies|albums|books|shows|series|songs)\b)/.test(q);
  return typeImplied ? MOCK_TV_SERIES : MOCK_HYBRID;
}
