// Adapter between the builder table and the shared resolve/import endpoints
// (#433). The builder deliberately does not share the web app's resolution UI —
// same endpoints, different job: a curator resolves one ambiguity mid-import,
// staff bulk-adjudicate fifty rows at once.
//
// Shapes below are the ones prod actually returns, confirmed 2026-08-12 against
// listgem-platform-production. Inputs stay `unknown` and outputs strict so the
// surface degrades to "unresolved, search it by hand" rather than crashing, but
// the field names are no longer guesses:
//
//   POST /imports/parse  { text }
//     -> { success, candidates: [{ position, raw_text, inferred_type }], … }
//        (position is 0-based)
//   POST /resolve        { type, title|name }        <- type is REQUIRED
//     -> { status, match, confidence, reason, suggestions[] }
//   POST /resolve/batch  { candidates: [{ type, title }] }
//     -> { results: [{ index, status, match, confidence, reason, suggestions[] }],
//          count, resolved_count, pending_count, timed_out, took_ms }
//
// `suggestions` is the alternates list — on a `no_match` it is what the operator
// picks from, so it must never be auto-adopted as the resolution.

export const BATCH_LIMIT = 200; // one rate-limit unit per call

export type RowStatus = 'resolved' | 'ambiguous' | 'unresolved' | 'pending';

export interface StatusSpec {
  label: string;
  cls: string;
}

export interface Candidate {
  thing_id: string | null;
  title: string;
  type: string | null;
  creator: string | null;
  year: number | string | null;
  image_url: string | null;
  score: number | null;
  /**
   * False for a federated hit that exists in TMDB/Spotify/Books but not in our
   * registry. Those carry no thing_id and cannot be attached to a pitch until
   * there's a way to materialise a Thing without a list (listgem-platform#550).
   */
  in_registry: boolean;
  /** 'local' for a registry hit, otherwise the external source that found it. */
  source: string | null;
}

/** One line in the builder table. The builder holds the ordering. */
export interface BuilderRow {
  raw_text: string;
  thing_id: string | null;
  status: RowStatus;
  candidates: Candidate[];
  match: Candidate | null;
  note: string;
  dropped: boolean;
  /** From /imports/parse; falls back to the pitch's thing_type when null. */
  inferred_type: string | null;
  confidence: number | null;
  reason: string | null;
}

/** The part of a row that resolution owns. */
export interface Resolution {
  status: RowStatus;
  thing_id: string | null;
  match: Candidate | null;
  candidates: Candidate[];
  confidence: number | null;
  reason: string | null;
}

export interface ParsedCandidate {
  position: number;
  raw_text: string;
  inferred_type: string | null;
}

/** POST /resolve and each element of /resolve/batch's `candidates`. */
export interface ResolveRequest {
  type: string;
  title: string;
}

/** PUT /pitches/:id/items element. `resolution_status` is only ever these two. */
export interface ItemPayload {
  raw_text: string;
  thing_id: string | null;
  resolution_status: 'resolved' | 'ambiguous';
  note: string | null;
}

export interface RowCounts {
  total: number;
  kept: number;
  dropped: number;
  resolved: number;
  ambiguous: number;
  unresolved: number;
  pending: number;
}

type Loose = Record<string, unknown>;

export const ROW_STATUS: Record<RowStatus, StatusSpec> = {
  resolved: { label: 'Resolved', cls: 'bg-green-100 text-green-700' },
  ambiguous: { label: 'Ambiguous', cls: 'bg-yellow-100 text-yellow-700' },
  unresolved: { label: 'Unresolved', cls: 'bg-gray-100 text-gray-600' },
  pending: { label: 'Pending', cls: 'bg-blue-100 text-blue-700' },
};

export function isRowStatus(value: unknown): value is RowStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROW_STATUS, value);
}

/**
 * The server's verdict vocabulary, mapped onto the four the builder shows.
 * `found_existing` and `no_match` are what prod returns today; the rest are
 * accepted so a new verdict name doesn't silently read as "unresolved".
 */
const SERVER_STATUS: Record<string, RowStatus> = {
  found_existing: 'resolved',
  created_new: 'resolved',
  matched: 'resolved',
  exact: 'resolved',
  resolved: 'resolved',
  no_match: 'unresolved',
  not_found: 'unresolved',
  unresolved: 'unresolved',
  ambiguous: 'ambiguous',
  needs_review: 'ambiguous',
  pending: 'pending',
};

function isObject(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === 'string' && v) return v;
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Normalise one candidate entity from any of the shapes /resolve may nest it in. */
export function normalizeCandidate(raw: unknown): Candidate | null {
  if (!isObject(raw)) return null;
  const nested = isObject(raw.thing) ? raw.thing : null;
  const thingId = firstString(raw.thing_id, raw.id, nested?.thing_id);
  const src: Loose = nested ? { ...nested, ...raw } : raw;
  const year = src.year ?? src.release_year ?? null;
  return {
    thing_id: thingId,
    title: firstString(src.title, src.name) || '(untitled)',
    type: firstString(src.thing_type, src.type),
    // `subtitle` is where /search-to-add puts artist/author/director.
    creator: firstString(src.creator, src.author, src.artist, src.subtitle),
    year: typeof year === 'number' || typeof year === 'string' ? year : null,
    image_url: firstString(src.image_url, src.image),
    score: typeof src.score === 'number' ? src.score : null,
    // /resolve returns graph neighbours, which are in the registry by
    // definition; only /search-to-add says so explicitly.
    in_registry: typeof src.in_registry === 'boolean' ? src.in_registry : !!thingId,
    source: firstString(src.source),
  };
}

/**
 * Results from GET /search-to-add — federated across the registry and the
 * external catalogues, registry hits sorted first by the API.
 *
 * This is the search box. /resolve is a duplicate-checker: it embeds a
 * candidate and asks the ER matcher whether we already hold it, which answers a
 * much narrower question and reports "no candidates" for anything the matcher
 * isn't confident about.
 */
export function normalizeSearchResults(data: unknown): Candidate[] {
  const list = Array.isArray(data)
    ? data
    : isObject(data) && Array.isArray(data.results)
      ? data.results
      : [];
  return list.map(normalizeCandidate).filter((c): c is Candidate => c !== null);
}

/**
 * Normalise one /resolve response (or one /resolve/batch element) into a row
 * patch. Status is taken from the server when it sends one, otherwise derived:
 * a thing_id means resolved, several candidates mean ambiguous, nothing means
 * unresolved.
 */
export function normalizeResolution(raw: unknown): Resolution {
  const empty: Resolution = {
    status: 'unresolved',
    thing_id: null,
    candidates: [],
    match: null,
    confidence: null,
    reason: null,
  };
  if (!isObject(raw)) return empty;

  const candidateSource = Array.isArray(raw.suggestions)
    ? raw.suggestions
    : Array.isArray(raw.candidates)
      ? raw.candidates
      : Array.isArray(raw.matches)
        ? raw.matches
        : Array.isArray(raw.results)
          ? raw.results
          : [];
  const candidates = candidateSource
    .map(normalizeCandidate)
    .filter((c): c is Candidate => c !== null);

  const match = normalizeCandidate(raw.thing || raw.match || raw.resolved || null);
  const reported = firstString(raw.status, raw.resolution_status);
  const mapped = reported ? SERVER_STATUS[reported] : undefined;
  const explicitId = firstString(raw.thing_id, match?.thing_id);

  // Promote a lone candidate ONLY when the server gave no verdict of its own.
  // `no_match` ships one suggestion often — adopting it would turn "we couldn't
  // match this" into a silent resolution.
  const thingId = explicitId || (!mapped && candidates.length === 1 ? candidates[0].thing_id : null);

  let status: RowStatus;
  if (mapped) status = mapped;
  else if (thingId) status = 'resolved';
  else status = candidates.length > 1 ? 'ambiguous' : 'unresolved';
  // A row with no thing_id is never "resolved", whatever the server called it.
  if (status === 'resolved' && !thingId) status = candidates.length > 1 ? 'ambiguous' : 'unresolved';

  return {
    status,
    thing_id: thingId,
    match: match?.thing_id ? match : candidates.find(c => c.thing_id === thingId) || null,
    candidates,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    reason: firstString(raw.reason),
  };
}

/** Ordered candidates out of POST /imports/parse — `{ position, raw_text }`. */
export function normalizeParsed(data: unknown): ParsedCandidate[] {
  const list = isObject(data) && Array.isArray(data.items)
    ? data.items
    : isObject(data) && Array.isArray(data.candidates)
      ? data.candidates
      : asArray(data);
  return list
    .map((c, i): ParsedCandidate => {
      const item = isObject(c) ? c : {};
      return {
        // prod's positions are 0-based; only the ordering matters here.
        position: typeof item.position === 'number' ? item.position : i + 1,
        raw_text: firstString(item.raw_text, item.text, typeof c === 'string' ? c : null) || '',
        inferred_type: firstString(item.inferred_type),
      };
    })
    .filter(c => c.raw_text.trim())
    .sort((a, b) => a.position - b.position);
}

/**
 * Split row indices into ≤200-per-call batches — one rate-limit unit each, so a
 * fifty-item build costs one unit and a re-check of the pending tail costs one
 * more.
 */
export function chunkForBatch(indices: number[], size: number = BATCH_LIMIT): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < indices.length; i += size) out.push(indices.slice(i, i + size));
  return out;
}

/**
 * `candidates` for POST /resolve/batch. `type` is required per candidate, and
 * the builder has no per-row type of its own — it uses the parser's
 * `inferred_type` when there is one and the pitch's `thing_type` otherwise.
 */
export function toBatchPayload(
  rows: BuilderRow[],
  indices: number[],
  fallbackType: string,
): ResolveRequest[] {
  return indices.map(rowIndex => ({
    type: rows[rowIndex].inferred_type || fallbackType,
    title: rows[rowIndex].raw_text,
  }));
}

/** Unwrap the batch response container — array, `{ results }` or `{ items }`. */
export function batchResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.resolutions)) return data.resolutions;
  return [];
}

/**
 * Map a batch response back onto rows. `index` is batch-local; `indexMap[i]` is
 * the global row it came from, so a scattered re-check of pending rows lands
 * back in the right places.
 */
export function applyBatchResults(
  rows: BuilderRow[],
  results: unknown,
  indexMap: number[],
): BuilderRow[] {
  const patch = new Map<number, Resolution>();
  for (const r of asArray(results)) {
    const index = isObject(r) ? r.index : undefined;
    const globalIndex = typeof index === 'number' ? indexMap[index] : undefined;
    if (globalIndex !== undefined) patch.set(globalIndex, normalizeResolution(r));
  }
  return rows.map((row, i) => {
    const found = patch.get(i);
    return found ? { ...row, ...found } : row;
  });
}

/** Rows still on the 60s server deadline — re-request these, don't call them unresolved. */
export function pendingIndices(rows: Pick<BuilderRow, 'status'>[]): number[] {
  return rows.reduce<number[]>((acc, row, i) => (row.status === 'pending' ? [...acc, i] : acc), []);
}

/**
 * Body for PUT /pitches/:id/items — the builder holds the ordering, so this
 * replaces the whole set. Dropped rows are simply absent.
 *
 * `resolution_status` is only ever `resolved` or `ambiguous`; a row without a
 * thing_id is stored as unresolved server-side regardless of what we send.
 */
export function toItemsPayload(rows: BuilderRow[]): ItemPayload[] {
  return rows
    .filter(row => !row.dropped && (row.raw_text || '').trim())
    .map(row => ({
      raw_text: row.raw_text.trim(),
      thing_id: row.thing_id || null,
      resolution_status: row.thing_id ? 'resolved' : 'ambiguous',
      note: row.note?.trim() ? row.note.trim() : null,
    }));
}

/** Counts for the builder's summary strip. */
export function summarize(rows: Pick<BuilderRow, 'status' | 'dropped'>[]): RowCounts {
  const live = rows.filter(r => !r.dropped);
  return {
    total: rows.length,
    kept: live.length,
    dropped: rows.length - live.length,
    resolved: live.filter(r => r.status === 'resolved').length,
    ambiguous: live.filter(r => r.status === 'ambiguous').length,
    unresolved: live.filter(r => r.status === 'unresolved').length,
    pending: live.filter(r => r.status === 'pending').length,
  };
}

/** Rows straight from pasted text, before any resolution has run. */
export function rowsFromParsed(parsed: ParsedCandidate[]): BuilderRow[] {
  return parsed.map(p => ({
    raw_text: p.raw_text,
    thing_id: null,
    status: 'unresolved',
    candidates: [],
    match: null,
    note: '',
    dropped: false,
    inferred_type: p.inferred_type ?? null,
    confidence: null,
    reason: null,
  }));
}

/**
 * Existing items from GET /pitches/:id, back into builder rows.
 *
 * Saved items carry no nested `thing`: the resolved entity's details live in
 * `thing_metadata` (title/year/poster_url) with the type in `thing_type_actual`.
 * Reading only a top-level `title` leaves every resolved row showing "—".
 * `position` is authoritative for ordering.
 */
export function rowsFromItems(items: unknown): BuilderRow[] {
  return asArray(items)
    .map(raw => (isObject(raw) ? raw : {}))
    .slice()
    .sort((a, b) => {
      const pa = typeof a.position === 'number' ? a.position : 0;
      const pb = typeof b.position === 'number' ? b.position : 0;
      return pa - pb;
    })
    .map((it): BuilderRow => {
      const thingId = firstString(it.thing_id);
      const meta = isObject(it.thing_metadata) ? it.thing_metadata : null;
      const nested = isObject(it.thing) ? it.thing : null;
      const matchSource = nested || (meta || it.title ? { ...(meta || {}), ...it } : null);
      const match = matchSource
        ? normalizeCandidate({
            ...matchSource,
            thing_id: thingId,
            type: firstString(it.thing_type_actual, (matchSource as Loose).type),
          })
        : null;
      return {
        raw_text: firstString(it.raw_text, it.text) || '',
        thing_id: thingId,
        status: isRowStatus(it.resolution_status)
          ? it.resolution_status
          : thingId
            ? 'resolved'
            : 'unresolved',
        candidates: [],
        match: match?.thing_id || match?.title !== '(untitled)' ? match : null,
        note: typeof it.note === 'string' ? it.note : '',
        dropped: false,
        inferred_type: firstString(it.thing_type_actual),
        confidence: null,
        reason: null,
      };
    });
}
