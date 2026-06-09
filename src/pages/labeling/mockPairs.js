// Seeded candidate pairs for the golden-set labeling tool (#404).
// Stand-in for `GET /admin/er/candidate-pairs` until #416 ships — modelled on
// the 80 edition-fragmentation clusters plus random / near-duplicate samples,
// chosen to exercise every label (same Work / same Edition / different / not-a-match)
// and the type-correctness check. Replaced by the live feed when available.
export const MOCK_PAIRS = [
  {
    pair_id: 'm1',
    reason: 'fragmentation_cluster',
    left:  { thing_id: 't101', title: 'Dune', creator: 'Frank Herbert', type: 'book', year: 1965, source: 'amazon', url: 'https://www.amazon.com/dp/0441013597', image_url: '', ids: { isbn13: '9780441013593' }, quality_score: 0.71 },
    right: { thing_id: 't102', title: 'Dune (Deluxe Edition)', creator: 'Frank Herbert', type: 'book', year: 2019, source: 'goodreads', url: 'https://www.goodreads.com/book/show/44767458', image_url: '', ids: { isbn13: '9780593099322' }, quality_score: 0.64 },
  },
  {
    pair_id: 'm2',
    reason: 'near_duplicate',
    left:  { thing_id: 't201', title: 'The Name of the Wind', creator: 'Patrick Rothfuss', type: 'book', year: 2007, source: 'amazon', url: 'https://www.amazon.com/dp/0756404746', image_url: '', ids: { isbn13: '9780756404741' }, quality_score: 0.69 },
    right: { thing_id: 't202', title: 'Name of the Wind', creator: 'Patrick Rothfuss', type: 'book', year: 2007, source: 'bookshop', url: 'https://bookshop.org/p/x', image_url: '', ids: { isbn13: '9780756404741' }, quality_score: 0.52 },
  },
  {
    pair_id: 'm3',
    reason: 'random',
    left:  { thing_id: 't301', title: 'The Pragmatic Programmer', creator: 'Hunt & Thomas', type: 'book', year: 1999, source: 'amazon', url: 'https://www.amazon.com/dp/020161622X', image_url: '', ids: { isbn13: '9780201616224' }, quality_score: 0.74 },
    right: { thing_id: 't302', title: 'Educated', creator: 'Tara Westover', type: 'book', year: 2018, source: 'goodreads', url: 'https://www.goodreads.com/book/show/35133922', image_url: '', ids: { isbn13: '9780399590504' }, quality_score: 0.66 },
  },
  {
    pair_id: 'm4',
    reason: 'fragmentation_cluster',
    left:  { thing_id: 't401', title: 'Sapiens: A Brief History of Humankind', creator: 'Yuval Noah Harari', type: 'book', year: 2011, source: 'amazon', url: 'https://www.amazon.com/dp/0062316117', image_url: '', ids: { isbn13: '9780062316110' }, quality_score: 0.78 },
    right: { thing_id: 't402', title: 'Sapiens (Audiobook)', creator: 'Yuval Noah Harari', type: 'audiobook', year: 2015, source: 'audible', url: 'https://www.audible.com/pd/x', image_url: '', ids: { asin: 'B0794RHPZD' }, quality_score: 0.58 },
  },
  {
    pair_id: 'm5',
    reason: 'fragmentation_cluster',
    left:  { thing_id: 't501', title: 'Crime and Punishment', creator: 'Fyodor Dostoevsky', type: 'book', year: 1866, source: 'gutenberg', url: 'https://www.gutenberg.org/ebooks/2554', image_url: '', ids: {}, quality_score: 0.49 },
    right: { thing_id: 't502', title: 'Crime and Punishment (Pevear & Volokhonsky tr.)', creator: 'Fyodor Dostoevsky', type: 'book', year: 1992, source: 'amazon', url: 'https://www.amazon.com/dp/0679734503', image_url: '', ids: { isbn13: '9780679734505' }, quality_score: 0.67 },
  },
  {
    pair_id: 'm6',
    reason: 'near_duplicate',
    left:  { thing_id: 't601', title: 'The Hobbit', creator: 'J.R.R. Tolkien', type: 'book', year: 1937, source: 'amazon', url: 'https://www.amazon.com/dp/054792822X', image_url: '', ids: { isbn13: '9780547928227' }, quality_score: 0.72 },
    right: { thing_id: 't602', title: 'The Hobbit — Complete Box Set (3 vols)', creator: 'J.R.R. Tolkien', type: 'book', year: 2012, source: 'amazon', url: 'https://www.amazon.com/dp/0345538374', image_url: '', ids: { isbn13: '9780345538376' }, quality_score: 0.55 },
  },
  {
    pair_id: 'm7',
    reason: 'fragmentation_cluster',
    left:  { thing_id: 't701', title: 'Project Hail Mary', creator: 'Andy Weir', type: 'book', year: 2021, source: 'amazon', url: 'https://www.amazon.com/dp/0593135202', image_url: '', ids: { isbn13: '9780593135204' }, quality_score: 0.7 },
    right: { thing_id: 't702', title: 'Project Hail Mary', creator: 'Andy Weir', type: 'book', year: 2021, source: 'goodreads', url: 'https://www.goodreads.com/book/show/54493401', image_url: '', ids: { isbn13: '9780593135204' }, quality_score: 0.63 },
  },
  {
    pair_id: 'm8',
    reason: 'random',
    left:  { thing_id: 't801', title: 'Inception (Original Motion Picture Soundtrack)', creator: 'Hans Zimmer', type: 'book', year: 2010, source: 'amazon', url: 'https://www.amazon.com/dp/x', image_url: '', ids: {}, quality_score: 0.31 },
    right: { thing_id: 't802', title: 'The Dark Knight', creator: 'Christopher Nolan', type: 'movie', year: 2008, source: 'tmdb', url: 'https://www.themoviedb.org/movie/155', image_url: '', ids: {}, quality_score: 0.6 },
  },
];
