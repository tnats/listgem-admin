import { beforeEach, describe, expect, it } from 'vitest';
import { buildDiagnostics } from './diagnostics';
import { clearRequestLog, record } from '../../api/requestLog';

const rows = [
  {
    raw_text: 'Persona (1966) 🇸🇪 8.6/10',
    thing_id: 'tvseries_hignfy_1990',
    status: 'resolved',
    match: { title: 'Have I Got News for You', type: 'TVSeries', year: 1990 },
    candidates: [{ thing_id: 'a' }, { thing_id: 'b' }],
    confidence: 0.42,
    reason: null,
    note: '',
    dropped: false,
  },
  {
    raw_text: 'The Hunt (2012)',
    thing_id: 'movie_the_hunt_2012',
    status: 'resolved',
    match: { title: 'The Hunt', type: 'Movie', year: 2012 },
    candidates: [],
    confidence: 1,
    reason: null,
    note: '',
    dropped: false,
  },
];

describe('build diagnostics', () => {
  beforeEach(() => clearRequestLog());

  it('records what was sent to the matcher, not just what the row shows', () => {
    // The gap between these two is where three separate defects lived.
    const d = buildDiagnostics({ pitchId: 'p_1', thingType: 'Movie', rows, counts: { kept: 2 } });
    expect(d.rows[0].raw_text).toBe('Persona (1966) 🇸🇪 8.6/10');
    expect(d.rows[0].search_title).toBe('Persona');
  });

  it('flags a row whose type cannot live on this pitch', () => {
    const d = buildDiagnostics({ pitchId: 'p_1', thingType: 'Movie', rows, counts: {} });
    expect(d.rows[0].wrong_type).toBe(true);
    expect(d.rows[0].matched_type).toBe('TVSeries');
    expect(d.rows[1].wrong_type).toBeUndefined();
  });

  it('carries confidence and candidate counts, which prose reports never do', () => {
    const d = buildDiagnostics({ pitchId: 'p_1', thingType: 'Movie', rows, counts: {} });
    expect(d.rows[0].confidence).toBe(0.42);
    expect(d.rows[0].candidates).toBe(2);
  });

  it('includes the recent API calls with their timings and rate-limit headers', () => {
    record({ at: '2026-08-25T10:00:00Z', method: 'POST', url: '/resolve/batch', status: 200, ms: 9800 });
    record({ at: '2026-08-25T10:00:20Z', method: 'GET', url: '/search-to-add', status: 429, ms: 30, rate_limit: { 'retry-after': '41' } });
    const d = buildDiagnostics({ pitchId: 'p_1', thingType: 'Movie', rows: [], counts: {} });
    expect(d.requests).toHaveLength(2);
    expect(d.requests[0].ms).toBe(9800);
    expect(d.requests[1].status).toBe(429);
    expect(d.requests[1].rate_limit['retry-after']).toBe('41');
  });

  it('carries nothing that identifies the target', () => {
    // The dump gets pasted into a chat window. Row text is list content; a
    // pitch id names a draft. Contact details, target name and tokens are not
    // in the builder's state and must never be collected into one blob here.
    const json = JSON.stringify(buildDiagnostics({ pitchId: 'p_1', thingType: 'Movie', rows, counts: {} }));
    expect(json).not.toMatch(/target_name|target_contact|@|Bearer|token/i);
  });
});
