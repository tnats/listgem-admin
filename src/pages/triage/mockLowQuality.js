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
  ],
  issue_breakdown: [
    { issue: 'missing_image', count: 9120 },
    { issue: 'low_enrichment', count: 7340 },
    { issue: 'missing_description', count: 4880 },
    { issue: 'uncertain_type', count: 2210 },
    { issue: 'missing_title', count: 1460 },
    { issue: 'general_low_quality', count: 796 },
  ],
};
