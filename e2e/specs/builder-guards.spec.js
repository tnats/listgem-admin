import { test, expect } from '../fixtures.js';

/**
 * The builder's guards, asserted on the rendered page.
 *
 * Each of these has a unit test already. They are here because the unit tests
 * were green while the rendered page was wrong: candidate art read from a field
 * that is null in production, a note field whose label contradicted where the
 * data went, a rail asking an operator to finish a list the API rejects edits
 * to. Shape was never the problem.
 */
test.describe('builder guards', () => {
  test('a pasted table resolves to titles, and the heading row is dropped', async ({ page, pitch }) => {
    await page.goto(`/concierge/${pitch.pitchId}`);

    await page.locator('textarea').first().fill([
      'Rank Film Year Worldwide gross Ref',
      '1 Jaws 1975 $495,201,848 [13][14]',
      '2 The Exorcist 1973 $430,872,776 [19][20]',
      '3 Get Out 2017 $255,751,443 [75][76]',
    ].join('\n'));
    await page.getByRole('button', { name: /parse & resolve/i }).click();

    // The films resolve by title, not by the pasted line.
    await expect(page.getByRole('cell', { name: /^Jaws/ })).toBeVisible();
    await expect(page.locator('tbody')).toContainText('The Exorcist');

    // The heading is recognised and struck through, not sent to the matcher.
    await expect(page.locator('tbody tr').first()).toContainText('Rank Film Year');
    await expect(page.getByText(/1 dropped/i)).toBeVisible();
  });

  test('two rows on one film name both rows and block the save', async ({ page, pitch }) => {
    await page.goto(`/concierge/${pitch.pitchId}`);

    await page.locator('textarea').first().fill(['Persona (1966)', 'Persona', 'Jaws (1975)'].join('\n'));
    await page.getByRole('button', { name: /parse & resolve/i }).click();

    // Naming only the later row sent an operator to delete the correct one, so
    // the strip names both and refuses to say which is wrong.
    const strip = page.getByText(/both point at/i);
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Rows 1 and 2');
    await expect(page.getByRole('button', { name: /^save items/i })).toBeDisabled();

    await page.getByRole('button', { name: /^Drop row 2$/ }).click();
    await expect(page.getByRole('button', { name: /^save items/i })).toBeEnabled();
  });

  test('candidates carry cover art', async ({ page, pitch }) => {
    // Read from image_url alone this renders empty boxes for every candidate:
    // that field is null on all 11,952 Movie things, and the art is at
    // metadata.poster_url.
    await page.goto(`/concierge/${pitch.pitchId}`);
    await page.locator('textarea').first().fill('Hannibal (2001)');
    await page.getByRole('button', { name: /parse & resolve/i }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);

    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: /^search$/i }).click();

    const art = page.locator('img[src*="image.tmdb.org"], img[src*="/images/proxy"]');
    await expect(art.first()).toBeVisible();
  });

  test('the two note fields say who reads them', async ({ page, pitch }) => {
    // One of these used to be labelled "internal" and was copied onto the
    // target's own list.
    await page.goto(`/concierge/${pitch.pitchId}`);
    await page.locator('textarea').first().fill('Jaws (1975)');
    await page.getByRole('button', { name: /parse & resolve/i }).click();
    await page.locator('tbody tr').first().click();

    await expect(page.getByText(/Note on this item/i)).toContainText(/target sees this/i);
    await expect(page.getByText(/^Internal note/i)).toContainText(/copied nowhere/i);
  });
});
