import { test, expect, api, SITE } from '../fixtures.js';

/**
 * What a target sees. These are the surfaces where a defect costs us a person
 * rather than a bug report, and every one of them shipped a leak this month:
 * the invite showed nothing, the preview rendered the operator's own working
 * line, and a claimed list arrived carrying an issue number.
 *
 * Built through the API rather than the UI — the builder is covered by
 * builder-guards.spec.js, and what is under test here is the output.
 */
const ITEMS = [
  {
    raw_text: 'Persona (1966) \u{1F1F8}\u{1F1EA} 8.6/10',
    display_text: 'Persona',
    thing_id: 'movie_persona_1966_4d7b531f',
    resolution_status: 'resolved',
    note: 'The one that made me want to make films.',
    internal_note: 'INTERNAL-PROBE check the 1966 Bergman, not the 2011 anime',
  },
  {
    raw_text: 'The Emigrants + The New Land (1971, 1972) \u{1F1F8}\u{1F1EA} 8.6/10',
    display_text: 'The Emigrants + The New Land',
    thing_id: null,
    resolution_status: 'ambiguous',
    note: null,
    internal_note: null,
  },
];

async function stocked(pitch) {
  await api('PUT', `/pitches/${pitch.pitchId}/items`, { items: ITEMS }, pitch.token);
  return api('POST', `/pitches/${pitch.pitchId}/tokens`, {}, pitch.token);
}

test.describe('what the target sees', () => {
  test('the preview shows titles, never the operator\'s line', async ({ page, pitch }) => {
    const { preview_token } = await stocked(pitch);
    await page.goto(`${SITE}/pitch/${preview_token}`);

    await expect(page.getByText('Persona').first()).toBeVisible();

    // An unresolved row belongs on the list — it is part of what they compiled
    // — but labelled, never with the pasted line, and never as a bare number.
    await expect(page.getByText('The Emigrants + The New Land')).toBeVisible();
    await expect(page.getByText(/8\.6\/10/)).toHaveCount(0);
    await expect(page.getByText(/\(1971, 1972\)/)).toHaveCount(0);

    // The note written for them appears; the working note does not.
    await expect(page.getByText(/made me want to make films/)).toBeVisible();
    await expect(page.getByText(/INTERNAL-PROBE/)).toHaveCount(0);

    // A forwardable link must not escalate into a capability.
    await expect(page.getByRole('button', { name: /claim/i })).toHaveCount(0);
  });

  test('the invite shows the list rather than describing it', async ({ page, pitch }) => {
    const { invite_token } = await stocked(pitch);
    await api('POST', `/pitches/${pitch.pitchId}/status`, { status: 'pitched' }, pitch.token);

    await page.goto(`${SITE}/signup?invite=${invite_token}`);

    await expect(page.getByText(/a list is waiting for you/i)).toBeVisible();
    await expect(page.getByText('E2E — automated').first()).toBeVisible();
    // Being asked to make an account for a list you cannot see is the thing
    // this surface exists to avoid.
    await expect(page.getByText('Persona')).toBeVisible();
    await expect(page.getByText(/INTERNAL-PROBE/)).toHaveCount(0);
  });

  test('a draft invite is refused, and the count is what will land', async ({ pitch }) => {
    const { invite_token } = await stocked(pitch);

    // Still a draft: the server refuses, which is why the portal warns before
    // an operator ever copies the link.
    const draft = await fetch(`${process.env.API_URL || 'https://listgem-platform-production.up.railway.app'}/pitches/invite/${invite_token}`);
    expect(draft.status).toBe(410);
    expect((await draft.json()).reason).toBe('not_claimable_from_draft');

    await api('POST', `/pitches/${pitch.pitchId}/status`, { status: 'pitched' }, pitch.token);
    const live = await api('GET', `/pitches/invite/${invite_token}`);

    // Two items on the pitch, one of them unresolved: one will land. Promising
    // the draft's row count would be a promise the claim quietly breaks.
    expect(live.valid).toBe(true);
    expect(live.item_count).toBe(1);
    expect(live.sample.map(s => s.title)).toEqual(['Persona']);
  });
});
