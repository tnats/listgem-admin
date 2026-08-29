/**
 * Contract probe: does production still return the fields this portal reads?
 *
 * Every expensive bug in the concierge surface has been a contract failure, not
 * a logic failure — and the unit suite was green through all of them, because a
 * fixture carries whichever field name its author picked:
 *
 *   - candidate art read from `image_url`, which is null on every Movie in the
 *     registry; the art is at `metadata.poster_url`
 *   - the rail read `item_count` from an endpoint that returns rows and no
 *     aggregates
 *   - the signup page read `skipped[].raw_text` after the server stopped
 *     sending it, so a claim that dropped an item said nothing about it
 *   - the preview page fell back to `raw_text` after it was removed entirely,
 *     rendering unresolved rows as bare row numbers
 *
 * The last two originated in another repo. Nothing in this one's CI would have
 * run, which is the argument for a probe that can be scheduled rather than
 * only fired at build time.
 *
 * Reads only, except one scratch pitch which is taken down in a finally block.
 *
 *   npm run check:contract
 *
 * Credential: ADMIN_TOKEN in the environment, or ~/.listgem_admin_cred holding
 * {"token": "..."} or {"email": "...", "password": "..."}.
 */
import { readFileSync } from 'node:fs';

const API = process.env.API_URL || 'https://listgem-platform-production.up.railway.app';

const failures = [];
const notes = [];

function check(name, condition, detail) {
  if (condition) return true;
  failures.push(detail ? `${name} — ${detail}` : name);
  return false;
}

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return (await res.json()).token;
}

async function credential() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  // Scheduled runs use email + password, not a token: a JWT lasts 24 hours, so
  // a token in a repo secret turns a monitor into something that reports a
  // stale credential as a contract failure the morning after it is set.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    return login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  }
  let cred;
  try {
    cred = JSON.parse(readFileSync(`${process.env.HOME}/.listgem_admin_cred`, 'utf8'));
  } catch {
    throw new Error('No credential: set ADMIN_TOKEN, or ADMIN_EMAIL + ADMIN_PASSWORD, or write ~/.listgem_admin_cred');
  }
  if (cred.token) {
    const claims = JSON.parse(Buffer.from(cred.token.split('.')[1], 'base64url').toString());
    if (claims.exp && claims.exp * 1000 < Date.now()) {
      throw new Error(`Credential expired ${new Date(claims.exp * 1000).toISOString()}`);
    }
    return cred.token;
  }
  return login(cred.email, cred.password);
}

const token = await credential();
const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
let pitchId = null;

try {
  // ---- The catalogue search that feeds candidate rows --------------------
  // The builder shows a poster per candidate. It reads image_url, then
  // metadata.poster_url, then metadata.image; if a response ever carries art
  // under a fourth name we render an empty box and nobody reports it.
  const search = await (await fetch(`${API}/search-to-add?query=Persona&type=Movie`, { headers: auth })).json();
  const results = search.results || search.items || search;
  check('search-to-add returns results', Array.isArray(results) && results.length > 0);
  if (Array.isArray(results) && results.length) {
    const local = results.find(r => r.in_registry) || results[0];
    const art = local.image_url || local.metadata?.poster_url || local.metadata?.image;
    check('a registry candidate carries art under a name we read', !!art,
      `keys: ${Object.keys(local).join(',')}${local.metadata ? ` | metadata: ${Object.keys(local.metadata).join(',')}` : ''}`);
    const ids = results.map(r => r.thing_id).filter(Boolean);
    check('candidates are not duplicated by thing_id', new Set(ids).size === ids.length,
      'the builder dedupes, but a duplicate here means ranking ran over a set that is not what it appears to be');
  }

  // ---- A scratch pitch, for the write path and the public surfaces -------
  const made = await fetch(`${API}/pitches`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      target_name: 'CONTRACT CHECK — automated',
      proposed_title: 'CONTRACT CHECK — automated',
      thing_type: 'Movie',
      notes: 'Created by scripts/contract-check.mjs. Taken down in the same run.',
    }),
  });
  const madeBody = await made.json();
  if (!check('POST /pitches creates a pitch', made.status === 201 || made.ok, `status ${made.status}`)) {
    throw new Error('cannot continue without a scratch pitch');
  }
  pitchId = madeBody.pitch?.pitch_id;

  // ---- PUT items: the fields the builder sends ---------------------------
  // display_text and internal_note both went in as nullable columns; an
  // endpoint that silently drops one would look identical from here except
  // that the value never arrives.
  const put = await fetch(`${API}/pitches/${pitchId}/items`, {
    method: 'PUT', headers: auth,
    body: JSON.stringify({
      items: [
        { raw_text: 'Persona (1966) probe', display_text: 'Persona', thing_id: null, resolution_status: 'ambiguous', note: 'target-visible probe', internal_note: 'internal probe' },
      ],
    }),
  });
  check('PUT items accepts the builder payload', put.ok, `status ${put.status}`);

  const detail = await (await fetch(`${API}/pitches/${pitchId}`, { headers: auth })).json();
  const stored = detail.items?.[0] || {};
  check('GET /pitches/:id returns the item rows', Array.isArray(detail.items) && detail.items.length === 1);
  check('display_text round-trips', stored.display_text === 'Persona', `got ${JSON.stringify(stored.display_text)}`);
  check('internal_note round-trips', stored.internal_note === 'internal probe', `got ${JSON.stringify(stored.internal_note)}`);
  check('note round-trips', stored.note === 'target-visible probe', `got ${JSON.stringify(stored.note)}`);
  // The rail counts rows because this endpoint does not aggregate them. If it
  // ever starts, that is worth knowing rather than worth ignoring.
  if (detail.pitch?.item_count == null) notes.push('GET /pitches/:id still omits item_count — the rail counts rows, as intended');

  // ---- The public surfaces ----------------------------------------------
  const tokens = await (await fetch(`${API}/pitches/${pitchId}/tokens`, { method: 'POST', headers: auth, body: '{}' })).json();
  check('tokens are issued', !!tokens.preview_token && !!tokens.invite_token);

  const previewRaw = await (await fetch(`${API}/pitches/preview/${tokens.preview_token}`)).text();
  const preview = JSON.parse(previewRaw);
  const pItem = preview.items?.[0] || {};
  check('preview carries display_text', typeof pItem.display_text === 'string',
    `item keys: ${Object.keys(pItem).join(',')}`);
  check('preview does NOT carry raw_text', !('raw_text' in pItem),
    'operator notation on a public, forwardable page');
  check('preview leaks no internal note', !previewRaw.includes('internal probe'));
  check('preview carries the target-visible note', previewRaw.includes('target-visible probe'));

  // A draft cannot be claimed. The admin mirrors this rule so staff aren't
  // handed a link the target's own screen would refuse — which is how one went
  // out before the rule was mirrored.
  const draftInvite = await (await fetch(`${API}/pitches/invite/${tokens.invite_token}`)).json();
  check('a draft invite is refused', draftInvite.valid === false && draftInvite.reason === 'not_claimable_from_draft',
    `got ${JSON.stringify(draftInvite)}`);

  const moved = await fetch(`${API}/pitches/${pitchId}/status`, {
    method: 'POST', headers: auth, body: JSON.stringify({ status: 'pitched' }),
  });
  check('a draft can be marked pitched', moved.ok, `status ${moved.status}`);

  const inviteRaw = await (await fetch(`${API}/pitches/invite/${tokens.invite_token}`)).text();
  const invite = JSON.parse(inviteRaw);
  check('a pitched invite validates', invite.valid === true, `reason ${invite.reason}`);
  check('invite reports what will land', typeof invite.item_count === 'number');
  check('invite carries a sample array', Array.isArray(invite.sample));
  check('invite leaks no internal note', !inviteRaw.includes('internal probe'));
  check('invite carries no token of any kind', !/"(?:preview|invite)_token"/.test(inviteRaw));
  // The one probe row is unresolved, so nothing lands and nothing is sampled.
  check('invite counts what lands, not draft rows', invite.item_count === 0,
    `one unresolved row on the pitch; got item_count ${invite.item_count}`);
} finally {
  if (pitchId) {
    const down = await fetch(`${API}/pitches/${pitchId}/takedown`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ reason: 'Automated contract check.' }),
    });
    if (!down.ok) failures.push(`cleanup failed for ${pitchId} — status ${down.status}, take it down by hand`);
  }
}

for (const n of notes) console.log(`note   ${n}`);
if (failures.length === 0) {
  console.log('contract ok');
  process.exit(0);
}
console.error(`\n${failures.length} contract failure(s):`);
for (const f of failures) console.error(`  ✗ ${f}`);
process.exit(1);
