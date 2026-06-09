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
