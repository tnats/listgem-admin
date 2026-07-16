# Admin app updates — 2026-07 backlog review

Plan derived from the batch of platform issues closed **2026-06 → 2026-07-16** (`tnats/listgem-platform`).
Each item below is written as a fileable issue. Admin + backend issues both live in `tnats/listgem-platform`.

**Architecture note:** every admin page already uses a *live-endpoint-with-mock-fallback* pattern — it
renders live data when authed and a "seeded sample" otherwise. So the mock files are not defects; the
work here is **contract drift** (fields backend changed) and **strategic gaps** (mechanisms the new
backend work introduced that the admin can't yet observe).

Priority key: **P0** confirmed drift, ship now · **P1** #456 epic alignment · **P2** quality surfaces · **P3** enhancements.
Effort: XS < 1h · S ~½ day · M ~1–2 days · L > 2 days.

---

## P0 — Confirmed contract drift (no backend dependency)

### A1 · Scorecard: read stable canonical-ID coverage field + add "strong" tile
- **Source:** #414 (closed, backend `4446a33`).
- **Why:** `ScorecardPage.jsx:234–238` still defensively probes 4 guessed key names. Backend now
  returns a documented shape:
  ```jsonc
  "canonical_id_coverage": { "any_pct": 97.3, "strong_pct": 96.6, "any_count": 78176, "strong_count": 77646, "total": 80385 }
  ```
- **Change:**
  - Replace probing with `dedupData.canonical_id_coverage.any_pct` (keep `canonical_id_coverage_pct` alias as one-line fallback).
  - Add a **"Canonical-ID coverage (strong)"** `MetricTile` using `.strong_pct`; baseline already present as `BASELINE.canonicalIdStrongPct` (95.4). Live is 96.6.
- **Files:** `src/pages/scorecard/ScorecardPage.jsx`, `src/pages/scorecard/baseline.js`.
- **Acceptance:** "any" tile reads 97.3 with no key-probing; "strong" tile renders 96.6 vs 95.4 baseline.
- **Effort:** XS.

### A2 · Scorecard: confirm fragmentation baseline + surface Work-structure metrics
- **Source:** #418 (closed, backend `35e7d4d`).
- **Why:** already mostly wired — scorecard reads `fragmentation_pct` from snapshots (`:218`) and
  `editions_linked` (`:220`). #418 redefined the metric to *unresolved* clusters (live 2 / 0.2% vs
  baseline 80 / 8.4%) and added `works_total` (82), `works_multi_edition` (82) to the snapshot JSONB.
- **Change:** confirm `baseline.js` fragmentation baseline = 8.4% and the tile note states the
  definition change vs the 2026-06-07 baseline. Optionally add `MiniStat`s for `works_total` /
  `works_multi_edition`.
- **Files:** `src/pages/scorecard/ScorecardPage.jsx`, `src/pages/scorecard/baseline.js`.
- **Acceptance:** fragmentation tile shows ~0.2% trending against an 8.4% baseline; structure metrics visible.
- **Effort:** XS.

---

## P1 — Align with the #456 "curation, not directory" epic

The epic (W1–W5, all closed 2026-07-16) is a positioning pivot: **brands/destinations are modeled,
franchise/commodity-local is not.** `entity_kind` (chain/brand/destination) is now a first-class
ingestion classifier and Cafe/Gym/Bar/Store are retired from the taxonomy. The admin app has **zero
representation** of any of this today (grep of `src/` finds no `entity_kind`, chain/brand, or local
source). Nothing breaks, but the admin cannot observe the epic's central mechanism.

> **Refinement (2026-07-16 code audit):** `entity_kind` (chain/brand/destination) is a
> **Place/Organization** signal, but the entity browser is **Work/edition-centric** (creative works —
> books/movies), so it is the wrong home for it. The admin has *no* place-centric surface today. B1 and
> B2 therefore merge into **one new "Places" monitor** (B1+B2 below), backed by a single new backend
> endpoint. Separately, type filters are already **data-driven** (triage's dropdown derives from returned
> rows; `/admin/type-rules` exists and is consumed in `PipelinePage`), so B3 shrinks to an optional
> drift panel.

### B1+B2 · New "Places" monitor — `entity_kind` distribution + chain-location watch
- **Source:** #456 W3 (#459), #453 (entity_kind classifier); #456 W5 (#462) — decision was to **leave**
  ~8,557 Hotels + ~1,426 Restaurants in place and "re-open the prune question only if usage data shows
  chain-location Things are actively polluting rankings/discovery." That signal belongs in the admin.
- **Change:** a new `/places` admin page with (a) an `entity_kind` distribution (chain vs brand vs
  destination, by type) so the classifier's live output is observable, and (b) a **chain-location
  pollution** tile — count + sample of Restaurant/Hotel Things carrying a `google_place_id` + a
  recognized chain brand (the merge-into-brand candidates from #456's migration notes), ideally trended.
- **Backend dependency:** one companion endpoint — `GET /metrics/places/entity-kind` (aggregate) +
  chain-location candidate count/sample. **Filed as tnats/listgem-platform#470** (backend · admin-portal
  · place-identification). Admin render work starts once the shape lands; seeded-sample fallback until then.
- **Effort:** M (admin) + backend.

### B3 · Taxonomy-drift panel (optional)
- **Source:** #441 (VisualArtwork/Painting contradiction + 24 drifted `parent_type` rows); #456 taxonomy prune.
- **Note:** the original "route type enums through `/admin/type-rules`" ask is largely already satisfied
  — filters are data-driven and the endpoint exists. Remaining value is a small **taxonomy-drift panel**
  (drifted `parent_type` count, retired-type sightings) on the Pipeline or a settings page.
- **Backend dependency:** a drift count on `/admin/type-rules` (or a small `/metrics/taxonomy-drift`).
- **Effort:** S. **Downgraded to P2** — nice-to-have, not epic-critical.

---

## P2 — Quality surfaces the new fixes make observable

### C1 · Triage: mistyped-Person / non-content-type issue category
- **Source:** #442 (article byline extracted as Person Thing), #429 (Person floods type-implied search).
- **Change:** add a "mistyped Person" category to the triage `issue_breakdown` so re-enrich can target them.
- **Backend dependency:** classify/emit the category on `/metrics/low-quality-things`.
- **Effort:** S (+ backend).

### C2 · Search inspector: type-facet distribution view
- **Source:** #429 — the relevance regression is only visible as a type distribution (Person 65% of "Best TV Series").
- **Change:** add a facet/type-distribution panel to `SearchQualityPage` (via `?facets=true` /
  `/search/hybrid` facets) alongside the existing relevance judging, so Person-flooding regressions are visible.
- **Effort:** S.

---

## P3 — New backend capabilities worth an admin control surface

### D1 · Triage: quality-tail re-enrich sweep controls
- **Source:** #420 — flag-gated background re-enrich sweep (kill switch, batches, worst-first).
- **Change:** surface sweep status + batch progress + a trigger on the triage page (beyond the current per-item re-enrich).
- **Backend dependency:** a sweep status/trigger endpoint.
- **Effort:** M (+ backend).

### D2 · Image-quality page: dead-link + Commons-normalization metrics
- **Source:** #424 — dead-link detection, Commons thumbnail normalization, `image_quality_score` decision.
- **Change:** add broken/dead-image and normalized-coverage metrics to `ImageQualityPage`.
- **Backend dependency:** the corresponding fields on the image analytics endpoints.
- **Effort:** S–M (+ backend).

---

## Suggested sequencing
1. **A1, A2** now — XS, no dependencies, ship as one small PR.
2. File backend companion issues for **B1, B2, C1, D1, D2** (fields/endpoints), then implement admin side as they land.
3. **B3, C2** — admin-only, schedule after P0.

## Not requiring admin changes (recorded for completeness)
- **#432** type-aware image placeholder, **#430** create-and-add, **#463** retire location-clarification UI — all
  `listgem-website` (main frontend), not admin.
- **#460/#461/#462** W1/W2/W5 — product/backend; admin impact captured in B1/B2 above.
- **#451** `/search-to-add/add` source enum — main-frontend add flow; admin does not call this endpoint.
