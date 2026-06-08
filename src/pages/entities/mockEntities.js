// Seeded sample for the entity browser + ER review queue (#405).
// Stand-in for the live /works* + /admin/works/er-queue endpoints so the UI is
// demoable and verifiable offline; replaced by live data when reachable.

export const MOCK_WORKS = [
  {
    work_id: 'w-dune',
    title: 'Dune',
    creator: 'Frank Herbert',
    type: 'book',
    representative_thing_id: 't-dune-1',
    collections: [{ collection_id: 'c-dune', name: 'Dune (series)', kind: 'series' }],
    editions: [
      { thing_id: 't-dune-1', title: 'Dune', source: 'amazon', year: 1965, ranking: 3, ids: { isbn13: '9780441013593' }, quality_score: 0.71 },
      { thing_id: 't-dune-2', title: 'Dune (Deluxe Edition)', source: 'goodreads', year: 2019, ranking: 11, ids: { isbn13: '9780593099322' }, quality_score: 0.64 },
      { thing_id: 't-dune-3', title: 'Dune (Movie Tie-in)', source: 'barnesnoble', year: 2021, ranking: 27, ids: { isbn13: '9780593201893' }, quality_score: 0.58 },
    ],
  },
  {
    work_id: 'w-sapiens',
    title: 'Sapiens: A Brief History of Humankind',
    creator: 'Yuval Noah Harari',
    type: 'book',
    representative_thing_id: 't-sap-1',
    collections: [],
    editions: [
      { thing_id: 't-sap-1', title: 'Sapiens', source: 'amazon', year: 2011, ranking: 5, ids: { isbn13: '9780062316110' }, quality_score: 0.78 },
      { thing_id: 't-sap-2', title: 'Sapiens (Audiobook)', source: 'audible', year: 2015, ranking: 41, ids: { asin: 'B0794RHPZD' }, quality_score: 0.58 },
    ],
  },
  {
    work_id: 'w-hailmary',
    title: 'Project Hail Mary',
    creator: 'Andy Weir',
    type: 'book',
    representative_thing_id: 't-phm-1',
    collections: [],
    editions: [
      { thing_id: 't-phm-1', title: 'Project Hail Mary', source: 'amazon', year: 2021, ranking: 2, ids: { isbn13: '9780593135204' }, quality_score: 0.7 },
    ],
  },
  {
    work_id: 'w-hobbit',
    title: 'The Hobbit',
    creator: 'J.R.R. Tolkien',
    type: 'book',
    representative_thing_id: 't-hob-1',
    collections: [{ collection_id: 'c-mearth', name: 'Middle-earth', kind: 'franchise' }],
    editions: [
      { thing_id: 't-hob-1', title: 'The Hobbit', source: 'amazon', year: 1937, ranking: 4, ids: { isbn13: '9780547928227' }, quality_score: 0.72 },
      { thing_id: 't-hob-2', title: 'The Hobbit (Illustrated)', source: 'goodreads', year: 2020, ranking: 19, ids: { isbn13: '9780358653035' }, quality_score: 0.6 },
    ],
  },
];

export const MOCK_ER_QUEUE = [
  {
    id: 'q1',
    score: 0.52,
    reason: 'trigram+vector near-miss',
    candidate: { thing_id: 't-dune-omni', title: 'Dune (Complete Chronicles Omnibus)', creator: 'Frank Herbert', source: 'amazon', year: 2018, type: 'book', ids: { isbn13: '9780593201886' }, quality_score: 0.49 },
    match_work: { work_id: 'w-dune', title: 'Dune', creator: 'Frank Herbert', representative_thing_id: 't-dune-1', edition_count: 3 },
  },
  {
    id: 'q2',
    score: 0.44,
    reason: 'vector near-miss',
    candidate: { thing_id: 't-sap-br', title: 'Sapiens (Brazilian Portuguese ed.)', creator: 'Yuval Noah Harari', source: 'amazon', year: 2014, type: 'book', ids: { isbn13: '9788535925401' }, quality_score: 0.55 },
    match_work: { work_id: 'w-sapiens', title: 'Sapiens: A Brief History of Humankind', creator: 'Yuval Noah Harari', representative_thing_id: 't-sap-1', edition_count: 2 },
  },
  {
    id: 'q3',
    score: 0.58,
    reason: 'trigram+vector near-miss',
    candidate: { thing_id: 't-phm-uk', title: 'Project Hail Mary (UK Hardback)', creator: 'Andy Weir', source: 'waterstones', year: 2021, type: 'book', ids: { isbn13: '9781473608818' }, quality_score: 0.62 },
    match_work: { work_id: 'w-hailmary', title: 'Project Hail Mary', creator: 'Andy Weir', representative_thing_id: 't-phm-1', edition_count: 1 },
  },
];
