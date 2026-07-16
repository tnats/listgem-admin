// Seeded sample for the extraction-triage queue (#407), shaped like
// GET /metrics/low-quality-things. Stand-in until an authed session reaches
// the live endpoint. priority_score = usage_count * (1 - quality_score).
export const MOCK_LOW_QUALITY = {
  things: [
    { thing_id: 't-lq-1', type: 'book', title: 'Llama Llama Red Pajama', quality_score: 0.22, type_confidence: 0.91, enrichment_coverage: 0.18, usage_count: 142, primary_issue: 'missing_image', priority_score: 110.76 },
    { thing_id: 't-lq-2', type: 'book', title: '', quality_score: 0.14, type_confidence: 0.55, enrichment_coverage: 0.1, usage_count: 88, primary_issue: 'missing_title', priority_score: 75.68 },
    { thing_id: 't-lq-3', type: 'movie', title: 'Untitled Project (2024)', quality_score: 0.39, type_confidence: 0.62, enrichment_coverage: 0.25, usage_count: 67, primary_issue: 'uncertain_type', priority_score: 40.87 },
    { thing_id: 't-lq-4', type: 'book', title: 'The Silent Patient', quality_score: 0.46, type_confidence: 0.88, enrichment_coverage: 0.22, usage_count: 54, primary_issue: 'low_enrichment', priority_score: 29.16 },
    { thing_id: 't-lq-5', type: 'album', title: 'Greatest Hits', quality_score: 0.31, type_confidence: 0.71, enrichment_coverage: 0.2, usage_count: 38, primary_issue: 'missing_description', priority_score: 26.22 },
    { thing_id: 't-lq-6', type: 'book', title: 'Atomic Habits (intl ed.)', quality_score: 0.48, type_confidence: 0.93, enrichment_coverage: 0.41, usage_count: 49, primary_issue: 'general_low_quality', priority_score: 25.48 },
    { thing_id: 't-lq-7', type: 'game', title: '', quality_score: 0.19, type_confidence: 0.6, enrichment_coverage: 0.12, usage_count: 27, primary_issue: 'missing_title', priority_score: 21.87 },
    { thing_id: 't-lq-8', type: 'movie', title: 'Inception', quality_score: 0.44, type_confidence: 0.49, enrichment_coverage: 0.33, usage_count: 31, primary_issue: 'uncertain_type', priority_score: 17.36 },
    // Person-as-content mistypes (#442) — decent quality_score, wrong TYPE; these
    // don't appear in the quality<0.5 tail, only under ?issue=person_as_content.
    { thing_id: 't-pac-1', type: 'Person', title: 'S.J. Scott', quality_score: 0.66, type_confidence: 0.82, enrichment_coverage: 0.5, usage_count: 12, primary_issue: 'person_as_content', priority_score: 4.08 },
    { thing_id: 't-pac-2', type: 'Person', title: 'Courtney E. Ackerman', quality_score: 0.71, type_confidence: 0.79, enrichment_coverage: 0.55, usage_count: 6, primary_issue: 'person_as_content', priority_score: 1.74 },
  ],
  issue_breakdown: [
    { issue: 'missing_image', count: 9120 },
    { issue: 'low_enrichment', count: 7340 },
    { issue: 'missing_description', count: 4880 },
    { issue: 'uncertain_type', count: 2210 },
    { issue: 'missing_title', count: 1460 },
    { issue: 'general_low_quality', count: 796 },
    { issue: 'person_as_content', count: 2 },
  ],
  heuristics: {
    person_as_content: 'A Person Thing whose source URL is article/listicle-shaped, or that was created via a schema.org author/byline block over a content type (#442). Quality-independent — surfaced regardless of quality_score.',
  },
};

// Seeded sample for the quality-tail re-enrich sweep status (#473 / #420).
// Read-only — the sweep is a manual CLI (mode: 'manual_cli'), not a daemon,
// so there is no running flag and no start/stop control.
export const MOCK_SWEEP = {
  available: true,
  mode: 'manual_cli',
  running: null,
  flag_name: null,
  processed: 1840,
  pending: 0,
  remaining_candidates: 23960,
  avg_quality_delta: 0.21,
  last_run_at: '2026-07-15T09:12:00Z',
  outcomes: { improved: 1520, unchanged: 295, merged: 25 },
};
