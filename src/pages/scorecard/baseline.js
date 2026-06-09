// Frozen pre-epic baseline for the ER/KG scorecard (epic #395, issue #403).
// Captured 2026-06-07 — do NOT recompute these. They are the fixed reference
// point every metric is measured against as the entity-resolution epic lands.
export const BASELINE_DATE = '2026-06-07';

// Raw figures from the issue, kept verbatim for traceability.
export const BASELINE = {
  registryThings: 80383,
  registryBooks: 2165,
  canonicalIdAnyPct: 97.3,
  canonicalIdStrongPct: 95.4,
  editionFragmentationClusters: 80,
  editionFragmentationThings: 182,
  editionFragmentationBooksPct: 8.4,
  seriesCount: 10,
  seriesBooks: 44,
  seriesAvgSize: 4.4,
  extractionQualityAvg: 0.487,
  extractionLowQualityPct: 32.1,
};
