import { describe, expect, it } from 'vitest';
import { apiErrorMessage, itemRows } from './errors';

const err = (status, data) => ({ response: { status, data } });

describe('apiErrorMessage', () => {
  it('leads with the sentence, not the machine code', () => {
    // PUT /pitches/:id/items answers { error: 'TYPE_MISMATCH', message, items }.
    // "400 · TYPE_MISMATCH" tells an operator nothing they can act on.
    const msg = apiErrorMessage(
      err(400, {
        error: 'TYPE_MISMATCH',
        message: '1 item(s) do not match the pitch type "Movie". A pitch containing them could not be claimed.',
        expected_type: 'Movie',
        items: [{ position: 2, thing_id: 'tvseries_x', raw_text: 'Persona (1966)' }],
      }),
    );
    expect(msg).toContain('do not match the pitch type "Movie"');
    expect(msg).not.toContain('TYPE_MISMATCH');
  });

  it('translates 0-based positions into the row numbers on screen', () => {
    const e = err(400, { error: 'TYPE_MISMATCH', message: 'nope', items: [{ position: 2 }, { position: 5 }] });
    expect(apiErrorMessage(e)).toContain('Row 3, 6.');
    expect(itemRows(e)).toEqual([3, 6]);
  });

  it('keeps a human `error` as the headline', () => {
    expect(apiErrorMessage(err(404, { error: 'Pitch not found' }))).toBe('404 · Pitch not found');
  });

  it('still appends `allowed` on an illegal transition', () => {
    const msg = apiErrorMessage(err(409, { error: 'Illegal transition', allowed: ['archived'] }));
    expect(msg).toContain('Allowed from here: archived.');
  });

  it('still appends a differing message alongside a human error', () => {
    const msg = apiErrorMessage(err(409, { error: 'Cannot remove the last admin', message: 'Grant another admin first.' }));
    expect(msg).toContain('Cannot remove the last admin');
    expect(msg).toContain('Grant another admin first.');
  });

  it('falls back when there is no body at all', () => {
    expect(apiErrorMessage(new Error('Network Error'))).toBe('Network Error');
    expect(itemRows(undefined)).toEqual([]);
  });
});
