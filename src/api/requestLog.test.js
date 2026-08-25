import { beforeEach, describe, expect, it } from 'vitest';
import { clearRequestLog, recentRequests, recordError, recordResponse } from './requestLog';

describe('request log', () => {
  beforeEach(() => clearRequestLog());

  it('records method, url, status and duration', () => {
    recordResponse(
      { status: 200, config: { method: 'post', url: '/resolve/batch' }, headers: {} },
      Date.now() - 9800,
    );
    const [entry] = recentRequests();
    expect(entry.method).toBe('POST');
    expect(entry.url).toBe('/resolve/batch');
    expect(entry.ms).toBeGreaterThan(9000);
  });

  it('keeps the serverrate-limit headers, which are the whole point', () => {
    recordError(
      {
        message: 'Request failed',
        config: { method: 'get', url: '/search-to-add' },
        response: { status: 429, headers: { 'retry-after': '37', 'x-ratelimit-remaining': '0' }, data: { error: 'Too many search requests' } },
      },
      Date.now() - 40,
    );
    const [entry] = recentRequests();
    expect(entry.status).toBe(429);
    expect(entry.rate_limit).toEqual({ 'retry-after': '37', 'x-ratelimit-remaining': '0' });
    expect(entry.error).toBe('Too many search requests');
  });

  it('never records a request body or anything we sent', () => {
    // A PATCH on a pitch carries a real person's contact details and the
    // Authorization header carries a token. Neither belongs in a blob that
    // gets pasted into a chat window.
    recordResponse(
      {
        status: 200,
        config: {
          method: 'patch',
          url: '/pitches/p_1',
          data: JSON.stringify({ target_contact: 'ava@example.org' }),
          headers: { Authorization: 'Bearer secret' },
        },
        headers: {},
      },
      Date.now(),
    );
    expect(JSON.stringify(recentRequests())).not.toMatch(/example\.org|Bearer|secret/);
  });

  it('is a ring buffer, so a long session cannot grow without bound', () => {
    for (let i = 0; i < 250; i++) {
      recordResponse({ status: 200, config: { method: 'get', url: `/x/${i}` }, headers: {} }, Date.now());
    }
    const all = recentRequests();
    expect(all).toHaveLength(200);
    expect(all[all.length - 1].url).toBe('/x/249');
  });
});
