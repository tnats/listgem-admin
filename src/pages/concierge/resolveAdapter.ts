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

/**
 * Rows per /resolve/batch call — one rate-limit unit each.
 *
 * 100, not the 200 the endpoint allows: measured against prod, a batch costs
 * ~0.25s an item (41 items 10.7s, 82 items 20.2s), so a full 200 would run ~49s
 * into the server's 60s deadline and time out the whole chunk on any bad day.
 * Halving it costs one extra unit per 100 items and takes that off the table.
 */
export const BATCH_LIMIT = 100;

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
   * registry. Those carry no thing_id, and picking one materialises it through
   * POST /things/resolve-or-create before attaching (listgem-platform#550,
   * shipped) — so attaching is not evidence the registry already held it. The
   * builder reports which of the two happened; believe that, not the outcome.
   */
  in_registry: boolean;
  /** 'local' for a registry hit, otherwise the external source that found it. */
  source: string | null;
  /** e.g. 'tmdb_movie' — what POST /things/resolve-or-create keys on. */
  source_type: string | null;
  source_id: string | null;
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
  confidence: number | null;
  reason: string | null;
  /** Set for pasted rows: what the block-aware cleaner made of the raw text. */
  query?: RowQuery | null;
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

/**
 * What the parse step reports beyond the candidates themselves.
 *
 * `/imports/parse` caps input at `max_input_chars` (20,000 in production) and
 * sets `truncated` when it clips. Dropping that meant a long paste silently
 * lost its tail: the operator sees a plausible list of rows and no indication
 * that the last twenty never arrived.
 */
export interface ParseOutcome {
  candidates: ParsedCandidate[];
  truncated: boolean;
  maxInputChars: number | null;
  method: string | null;
}

/** POST /resolve and each element of /resolve/batch's `candidates`. */
export interface ResolveRequest {
  type: string;
  title: string;
  year?: number;
}

/** PUT /pitches/:id/items element. `resolution_status` is only ever these two. */
export interface ItemPayload {
  raw_text: string;
  thing_id: string | null;
  resolution_status: 'resolved' | 'ambiguous';
  note: string | null;
  /**
   * A line safe to show the target (listgem-platform#565).
   *
   * `raw_text` is operator notation — a pasted table row still carrying its
   * rank, box office and reference marks, or a curator's
   * "… (1971, 1972) 🇸🇪 8.6/10". A row that never resolved reaches the target
   * anyway, as a chip in the leftovers flow after they claim, and that surface
   * has no business showing our working notes.
   *
   * This is the title we actually searched on, so it is derived, never guessed:
   * the server deliberately does not fall back to `raw_text` or strip it by
   * regex, because mangling someone's formatting fails silently and a
   * plausible-but-wrong title is worse than one that is visibly notation.
   */
  display_text: string | null;
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
    // Art hides under several names, and the one this used to read is the one
    // production leaves empty: every Movie thing has metadata.poster_url and a
    // null top-level image_url (checked against prod, 2026-08-26 — 11,952 of
    // 11,952). A fixture would have been written with whichever name its author
    // picked and the tests would have passed either way.
    image_url: firstString(
      src.image_url,
      isObject(src.metadata) ? src.metadata.poster_url : null,
      isObject(src.metadata) ? src.metadata.image : null,
      src.poster_url,
      src.image,
    ),
    score: typeof src.score === 'number' ? src.score : null,
    // /resolve returns graph neighbours, which are in the registry by
    // definition; only /search-to-add says so explicitly.
    in_registry: typeof src.in_registry === 'boolean' ? src.in_registry : !!thingId,
    source: firstString(src.source),
    source_type: firstString(src.source_type),
    source_id: src.source_id == null ? null : String(src.source_id),
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
  // A `no_match` carrying suggestions is not a dead end — it is the server
  // saying "not confident, you pick". Reported as unresolved it read as "this
  // does not exist", and the operator had no reason to open the row: in a
  // 40-row build, Hannibal and two Resident Evils sat there as failures with
  // the right film already in hand. The thing_id stays null either way; this
  // changes what we call it, never what we adopt.
  if (mapped === 'unresolved' && !thingId && candidates.length > 0) status = 'ambiguous';
  else if (mapped) status = mapped;
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
/** The candidates alone, for callers that don't care how the parse went. */
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

/** The candidates plus whether the input was clipped on the way in. */
export function normalizeParseOutcome(data: unknown): ParseOutcome {
  const d = isObject(data) ? data : {};
  return {
    candidates: normalizeParsed(data),
    truncated: d.truncated === true,
    maxInputChars: typeof d.max_input_chars === 'number' ? d.max_input_chars : null,
    method: firstString(d.method),
  };
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
 * The text to match on, cleaned of list decoration.
 *
 * Source lists carry ratings, flags and bullets — `Persona (1966) 🇸🇪 8.6/10`.
 * Sending that whole string as the title degrades every stage: the ER matcher's
 * trigram similarity collapses, the vector distance widens, and
 * `filterSuggestions` then drops the alternates too, so a bad match arrives with
 * nothing to correct it. Short titles suffer worst — the noise outweighs them.
 *
 * The year comes out too, and travels as its own field — see `extractYear`.
 * Registry titles are bare ("Persona", not "Persona (1966)"), so a parenthetical
 * year lowers the trigram similarity it was meant to sharpen, and TMDB's search
 * doesn't parse it at all: "Persona (1966)" matches nothing there.
 *
 * `raw_text` is left untouched: it's what the operator recognises, and what the
 * target inherits on an unresolved row.
 */
/** Structural noise that is never part of a title, whatever the paste looks like. */
const REF_MARKS = /\s*\[\s*\d+\s*\]/g;
const FOOTNOTE_MARKS = /[\u2020\u2021]/g;
const MONEY = /\s*[$\u00a3\u20ac\u00a5]\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:million|billion|bn|m)\b)?/gi;
/** A leading integer with no punctuation after it — a rank cell, or a title. */
const RANK_CELL = /^\s*(\d{1,3})\s+(?=\S)/;
const TRAILING_YEAR = /\s+((?:19|20)\d{2})\s*$/;

/** What we actually ask the matcher for, per row. */
export interface RowQuery {
  title: string;
  year: number | null;
  /** A column-heading row rather than an item — "Rank Film Year Gross Ref". */
  header: boolean;
}

/**
 * Clean a whole pasted block at once, because the ambiguous parts of a table
 * row can only be read from the block.
 *
 * A pasted Wikipedia table row looks like `1 It 2017 $719,766,009 [1][2]`, and
 * per-row rules cannot safely strip either end of it: a leading integer is a
 * rank in that table and the title in `28 Days Later`, and a trailing year is
 * a year column here and part of the name in `Blade Runner 2049`. Across the
 * block the ambiguity resolves — a rank column counts 1, 2, 3 down the rows,
 * and a year column only appears alongside the other columns.
 *
 * This was not academic: a 41-row paste of the highest-grossing horror films
 * sent every one of those strings to the matcher as the title. The long
 * distinctive names survived it; `It`, `Signs` and `The Ring` drowned in the
 * noise and came back with no candidates at all.
 */
export function tableQueries(rawTexts: string[]): RowQuery[] {
  const texts = (rawTexts || []).map(t => t || '');

  // A rank column: most rows open with a bare integer, corroborated either by
  // the numbers stepping cleanly up or by the rest of the block being visibly
  // tabular. Ascending alone is too weak — 12 Angry Men, 28 Days Later, 300
  // climb by accident — and the sequence alone is too strict, since deleting a
  // few rows leaves gaps and re-sorting the table scrambles the order outright.
  // Money and reference columns are what a list of number-titled films lacks.
  const ranks = texts.map(t => {
    const m = t.match(RANK_CELL);
    return m ? Number(m[1]) : null;
  });
  const present = ranks.filter((r): r is number => r !== null);
  const ascending = present.every((r, i) => i === 0 || r > present[i - 1]);
  const steps = present.filter((r, i) => i > 0 && r === present[i - 1] + 1).length;
  const columnar = texts.filter(t => t.replace(REF_MARKS, '').replace(MONEY, ' ') !== t).length;
  const rankColumn =
    present.length >= 3 &&
    present.length >= texts.length * 0.6 &&
    // Either corroboration is enough on its own. Ascending order is not
    // required when the block is visibly tabular: an operator who re-sorts a
    // table by year before copying scrambles the ranks, and they are no less
    // ranks for it.
    ((ascending && steps >= (present.length - 1) * 0.8) || columnar >= texts.length * 0.6);

  return texts.map((raw, i) => {
    // A heading only reads as one against the table it heads: every item row
    // carries a rank and this one doesn't.
    const header = rankColumn && i === 0 && ranks[0] === null;

    let text = raw.replace(REF_MARKS, '').replace(FOOTNOTE_MARKS, ' ').replace(MONEY, ' ');
    // Only these columns prove the row is tabular. Without them a trailing
    // year is just as likely to be part of the name.
    let tabular = text !== raw;
    if (rankColumn && ranks[i] !== null) {
      text = text.replace(RANK_CELL, '');
      tabular = true;
    }

    let year: number | null = null;
    if (tabular) {
      const m = text.match(TRAILING_YEAR);
      // "Blade Runner 2049 2017" gives up the year column and keeps its name;
      // a row that is only a year ("1917") keeps all of it.
      if (m && text.replace(TRAILING_YEAR, '').trim()) {
        year = Number(m[1]);
        text = text.replace(TRAILING_YEAR, '');
      }
    }

    return { title: searchTitle(text), year: year ?? extractYear(raw), header };
  });
}

/**
 * The query for one row. Rows built from a paste carry the block-aware result;
 * anything else — a link, a catalogue pick, a saved item — falls back to what
 * can be read from the row alone.
 */
export function queryFor(row: BuilderRow): RowQuery {
  if (row.query) return row.query;
  return { title: searchTitle(row.raw_text), year: extractYear(row.raw_text), header: false };
}

export function searchTitle(rawText: string): string {
  return (rawText || '')
    // leading list decoration the parser may leave behind
    .replace(/^\s*(?:\d+[.)]|[-*•–—])\s*/, '')
    // ratings: 8.6/10, 4/5, 92%
    .replace(/\b\d+(?:\.\d+)?\s*\/\s*\d+\b/g, '')
    .replace(/\b\d{1,3}\s*%/g, '')
    // emoji and flags (regional indicators, pictographs, misc symbols)
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    // a trailing year, or a run of them: "(1971, 1972)"
    .replace(/\s*\((?:\s*(?:19|20)\d{2}\s*,?)+\)\s*/g, ' ')
    // wikipedia reference marks and the footnote daggers beside them
    .replace(REF_MARKS, '')
    .replace(FOOTNOTE_MARKS, ' ')
    // box-office columns: "$719,766,009", "£12.4 million"
    .replace(MONEY, ' ')
    // whatever separators the decoration left stranded
    .replace(/\s*[|·–—-]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The first four-digit year in the text, which the API takes as its own field. */
export function extractYear(rawText: string): number | null {
  const m = (rawText || '').match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

/**
 * `candidates` for POST /resolve/batch. `type` is required per candidate, and
 * it is ALWAYS the pitch's own type.
 *
 * Never a type derived from a row's current match. A list holds exactly one
 * type, so there is no legitimate row-level variation — and a row that matched
 * the wrong thing carries that thing's type, which would then constrain the
 * search meant to correct it. That happened: a Movie pitch whose row had
 * mismatched to a TVSeries searched TMDB's TV index and returned twenty
 * TV results, none of them the film.
 */
export function toBatchPayload(
  rows: BuilderRow[],
  indices: number[],
  fallbackType: string,
): ResolveRequest[] {
  return indices.map(rowIndex => {
    const { title, year } = queryFor(rows[rowIndex]);
    return {
      type: fallbackType,
      title,
      ...(year ? { year } : {}),
    };
  });
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
      // Null rather than an empty string when there is nothing to show: the
      // server treats null as "no display line", and an unlabelled chip beats
      // a blank one.
      display_text: queryFor(row).title.trim() || null,
    }));
}

/** Same pasted line twice — the key that survives a re-paste of the same list. */
function textKey(row: Pick<BuilderRow, 'raw_text'>): string {
  return (row.raw_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Incoming rows minus the ones already on the board.
 *
 * Appending a second paste of the same list produced 82 rows for a 40-film
 * list, half of them stale copies resolved from the older, noisier titles.
 * Nothing downstream would have caught it: a list can legitimately be built by
 * appending, so quantity is no signal.
 */
export function dedupeAgainst(
  existing: BuilderRow[],
  incoming: BuilderRow[],
): { rows: BuilderRow[]; skipped: number } {
  const seen = new Set(existing.filter(r => !r.dropped).map(textKey));
  const rows: BuilderRow[] = [];
  for (const row of incoming) {
    const k = textKey(row);
    // Blank lines can't collide with each other in any meaningful way.
    if (k && seen.has(k)) continue;
    if (k) seen.add(k);
    rows.push(row);
  }
  return { rows, skipped: incoming.length - rows.length };
}

/** Years of drift between a source line and a match that mean nothing. */
const YEAR_TOLERANCE = 2;

/** Reduce a title to what a comparison should care about. */
function compareKey(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Whether a resolved row disagrees with the line it came from, and how.
 *
 * Advisory, never blocking — a legitimate match often shifts a year (a film
 * dated 2020 by a box-office table and 2021 by the registry) and re-points a
 * title. What it catches is the match that agrees with nothing: "Hannibal"
 * (2001) resolved to "The Silence of the Lambs" (1991), which the matcher had
 * offered as its only suggestion, so the operator picked the one thing on
 * offer. Both signals were sitting in the row at the time.
 */
export function matchConcern(row: BuilderRow): string | null {
  if (row.dropped || !row.thing_id || !row.match) return null;
  const asked = queryFor(row);
  const reasons: string[] = [];

  const wanted = compareKey(asked.title);
  const got = compareKey(row.match.title || '');
  if (wanted && got && wanted !== got && !got.includes(wanted) && !wanted.includes(got)) {
    // Sequels and re-releases share words with what was asked for; a match
    // sharing none of them is a different work.
    const words = new Set(wanted.split(' ').filter(w => w.length >= 3));
    const shared = got.split(' ').some(w => w.length >= 3 && words.has(w));
    if (!shared) reasons.push(`matched “${row.match.title}”`);
  }

  // Number(null) and Number('') are both 0, and 0 is finite — so a match with
  // no year would read as disagreeing by two thousand of them.
  const rawYear = row.match.year;
  const gotYear = rawYear === null || rawYear === undefined || rawYear === '' ? NaN : Number(rawYear);
  // Two years, matching the window the server's suggestion filter keeps
  // (listgem-platform#564). Release dates vary by region and a registry can
  // date a film by its festival run; a decade is a different film. Disagreeing
  // with the server here would only flag matches it has already judged fine.
  //
  // Same rule as theirs, both halves: withheld — here, flagged — only when we
  // know both years and they disagree by more than two. A missing year on
  // either side says nothing, so it says nothing.
  if (asked.year && Number.isFinite(gotYear) && Math.abs(asked.year - gotYear) > YEAR_TOLERANCE) {
    reasons.push(`the line says ${asked.year}, the match is ${gotYear}`);
  }

  return reasons.length ? reasons.join('; ') : null;
}

/** Rows that landed on one thing, and what that thing is. */
export interface DuplicateGroup {
  thing_id: string;
  title: string | null;
  /** Every row in the group, in list order — not just the repeats. */
  indices: number[];
}

/**
 * Kept rows that resolved to the same thing.
 *
 * The text-level check can't see these: two different lines ("Alien" and
 * "Alien (1979)") resolving to one film is the same item twice on the list.
 *
 * Every row in the group is reported, not only the later ones, because the
 * later row is not reliably the wrong one. A mis-picked candidate on row 17
 * collided with the correct row 31, and naming only 31 pointed the operator
 * at the good row: dropping it would have kept the mistake and deleted the
 * film. Which row is wrong is a judgement about the match, so it belongs to
 * whoever can see both.
 */
export function duplicateGroups(rows: BuilderRow[]): DuplicateGroup[] {
  const byThing = new Map<string, number[]>();
  rows.forEach((row, i) => {
    if (row.dropped || !row.thing_id) return;
    const at = byThing.get(row.thing_id);
    if (at) at.push(i);
    else byThing.set(row.thing_id, [i]);
  });
  return [...byThing.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([thing_id, indices]) => ({
      thing_id,
      title: rows[indices[0]].match?.title || null,
      indices,
    }));
}

/** The repeats alone — every row in a group but the first. */
export function duplicateIndices(rows: BuilderRow[]): number[] {
  return duplicateGroups(rows).flatMap(g => g.indices.slice(1));
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
  const queries = tableQueries(parsed.map(p => p.raw_text));
  return parsed.map((p, i) => ({
    raw_text: p.raw_text,
    thing_id: null,
    status: 'unresolved',
    candidates: [],
    match: null,
    // Dropped rather than removed: it stays visible and struck through, and
    // one keystroke puts it back if the guess was wrong.
    note: queries[i].header ? 'Column headings, not an item.' : '',
    dropped: queries[i].header,
    confidence: null,
    reason: null,
    query: queries[i],
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
        confidence: null,
        reason: null,
      };
    });
}
