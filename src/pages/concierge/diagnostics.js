import { recentRequests } from '../../api/requestLog';
import { searchTitle } from './resolveAdapter';
import { typeMatchesPitch } from './pitchRules';

/**
 * A structured account of a build, for pasting to whoever is helping debug it.
 *
 * Every defect in this builder was found by an operator describing what they
 * saw and someone else inferring the cause — which took four rounds on one row
 * and got the cause wrong three times. This is the same information, without
 * the inference: what each row holds, what the API was asked, and what it said.
 *
 * Contains no contact details, no target name and no tokens. Row text is list
 * content — film titles — and the pitch id identifies a draft, not a person.
 */
export function buildDiagnostics({ pitchId, thingType, rows, counts, capturedAt = new Date().toISOString() }) {
  return {
    captured_at: capturedAt,
    pitch_id: pitchId,
    thing_type: thingType,
    counts,
    rows: (rows || []).map((row, i) => ({
      n: i + 1,
      raw_text: row.raw_text,
      // What we actually send the matcher, which is not what the row displays.
      search_title: searchTitle(row.raw_text),
      status: row.status,
      dropped: row.dropped || undefined,
      thing_id: row.thing_id,
      matched_title: row.match?.title ?? null,
      matched_type: row.match?.type ?? null,
      matched_year: row.match?.year ?? null,
      wrong_type: row.thing_id && !typeMatchesPitch(row.match?.type, thingType) ? true : undefined,
      confidence: row.confidence ?? null,
      reason: row.reason ?? null,
      candidates: row.candidates?.length || 0,
      note: row.note || undefined,
    })),
    requests: recentRequests(),
  };
}

/** The dump as pasteable text. */
export function diagnosticsText(input) {
  return JSON.stringify(buildDiagnostics(input), null, 2);
}
