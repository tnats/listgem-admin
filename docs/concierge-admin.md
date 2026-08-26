# Concierge + verification admin surface (#533)

Staff-facing UI for **#434 Concierge Pitch Lists** and **#435 Verification**. Both backends are live.
Contract, screens and invariants: `tnats/listgem-platform#533` (self-contained), plus CONCIERGE.md §9 in
`listgem-website`.

## What's here

| Screen | Route / location |
|---|---|
| Outreach board (kanban by status) | `/concierge` — `pages/concierge/OutreachBoardPage.jsx` |
| Target intake | "New target" on the board — `IntakeModal.jsx` |
| Builder (paste → parse → batch-resolve → adjudicate) | `/concierge/:pitchId` → Build tab — `PitchBuilder.jsx` |
| Preview + invite generation | Outreach tab — `TokensPanel.jsx` |
| Takedown | Outreach tab — `TakedownModal.jsx` |
| Confirm identity | Identity tab — `ConfirmIdentityModal.jsx` |
| Verify / unverify + history | `/moderation` → Verification tab, plus per-row actions in Users |

Shared primitives added for this cycle, and reusable everywhere: `components/Modal.jsx`,
`components/DataTable.jsx`, `components/Form.jsx` (Field/TextInput/TextArea/Select/Button),
`components/VerifiedBadge.jsx`.

## Typed where it counts

The portal is plain JSX and stays that way. Three modules are `.ts`, because they carry the contract this
feature actually turns on — seven statuses, a re-pitch flag that must never be confused with a status, two
token types, and the item payload:

- `pages/concierge/pitchRules.ts` — `PitchStatus`, `Pitch`, the transition map
- `pages/concierge/resolveAdapter.ts` — `BuilderRow`, `Resolution`, `ItemPayload`; inputs are `unknown` and
  outputs are strict, which is what makes reading the unspecified `/resolve` shapes defensible
- `pages/moderation/verificationRules.ts` — `VerificationMethod`, `PublicBadge` (no `method`, by type)

`tsconfig.json` runs `allowJs` with `checkJs: false`, so these sit beside untyped `.jsx` with no conversion
pressure, and `eslint.config.js` has a `**/*.{ts,tsx}` block so they don't silently drop out of linting.
`npm run typecheck`. The tests stay `.js` on purpose: several feed deliberately malformed input to the
validators, which is the behaviour being asserted.

## Before you open a PR: does the playbook still hold?

`listgem-website/docs/gtm/CONCIERGE-PLAYBOOK.md` is the operator manual for these
screens. **If a change alters what an operator sees or does, update the playbook in the same PR.**

This is written down because it has been got wrong three times in four days, each time by a change
made here:

| Change | What the playbook then said, wrongly |
|---|---|
| Assignee became a dropdown (#20) | "Agree one form as a team — the filter matches exactly" |
| Roles landed on the Users tab (#21) | "Ask engineering — there's no self-serve path and no API for it" |
| Search + add-by-link (#22/#23/#24) | "Add by URL — resolution works from titles, not links" |

None was caught by tests, review or CI, because none is a code defect. Each was found by an operator
following an instruction that had stopped being true — which is the expensive way to find it, and the
one that costs someone else's time rather than ours.

Worth checking whenever a PR touches:

- **A control's label, or what it does** — the two link boxes needed a table in §4 precisely because
  they were confusable on screen
- **An error or empty state** — "nothing found" changed meaning when search moved to `/search-to-add`,
  and an operator would act differently on the new meaning
- **Who can do something, or how they get access** — §0
- **Anything the API now permits that it didn't**, or vice versa

A one-line diff in the playbook is cheap. Discovering the drift by watching someone follow it is not.

## Where the invariants live

Each one is enforced by the API too — the UI's job is to never offer the action.

| Invariant | Enforced in | Pinned by |
|---|---|---|
| 1 · Never re-pitch an explicit decline | `pitchRules.canRepitch` / `offeredTransitions` — server flag is the only *allow*, `declined` is a hard *deny* | `pitchRules.test.js`, `OutreachBoardPage.test.jsx` |
| 2 · Evidence required to confirm identity | `confirmIdentityErrors`, submit disabled while empty | `pitchRules.test.js`, `PitchDetailPage.test.jsx` |
| 3 · Identity confirmed after the claim | `canConfirmIdentity` (status = `provisioned`) | `pitchRules.test.js`, `PitchDetailPage.test.jsx` |
| 4 · Takedown is one action | `TakedownModal` — single POST, all three effects named | `PitchDetailPage.test.jsx` |
| 5 · `verified_method` never renders | `VerifiedBadge` ignores it; it appears only in the amber "Internal — never publish" panel | `VerifiedBadge.test.jsx`, `verificationRules.test.js` |
| 6 · One badge, no tiers, no colours | `VerifiedBadge` renders byte-identical markup for every `type`/`proof` | `VerifiedBadge.test.jsx` |

Plus: items are frozen once `provisioned`/`archived` (`canEditItems`), and tokens can't be re-issued after
a claim, a decline, or a takedown (`tokenIssueBlockedReason`).

## The resolve contract, confirmed against prod (2026-08-12)

#533 pins `/pitches` and `/verification` exactly but not the resolve path, so the first build inferred it.
All three inferences were wrong. Verified live and corrected:

| | Inferred | Actual |
|---|---|---|
| `POST /resolve` body | `{ raw_text }` | `{ type, title }` — **`type` is required**, and a URL is not accepted at all |
| `POST /resolve/batch` body | `{ items: [{ position, raw_text }] }` | `{ candidates: [{ type, title }] }` |
| Verdict vocabulary | `resolved` / `ambiguous` | `found_existing`, `no_match` (mapped in `SERVER_STATUS`) |
| Alternates | `candidates` / `matches` | **`suggestions`** |
| `thing_type` source | `/admin/type-rules` | Not a type vocabulary — 355 crawler URL-pattern rules on `detected_type`. The canonical list is **`GET /types`** |

Two consequences worth keeping in mind:

- **Every resolve needs a type**, and the builder uses the pitch's own `thing_type`. That is correct rather
  than a compromise: `lists.thing_type` is NOT NULL and single-valued, and the trigger
  `validate_thing_type_match` (migration 067) enforces upward-only matching, so a genuinely mixed list
  cannot exist. Two pitches, not one. `inferred_type` from `/imports/parse` is the caller's hint echoed
  back — the parser never guesses per item — so it is only non-null for rows rebuilt from saved items,
  where it carries `thing_type_actual`.
- **`suggestions` must never be auto-adopted.** A `no_match` frequently ships exactly one suggestion,
  because the matcher is k-NN and the nearest thing to an unmatched title is usually one plausible-looking
  neighbour. `status` is the verdict; `suggestions` never is. Promoting it would turn "we could not match
  this" into a wrong link on a list we pitched to a real person. A lone candidate is adopted only when the
  server returned no verdict of its own. Pinned by a test.

Saved items are shaped differently again: no nested `thing`, with the resolved entity in `thing_metadata`
(title/year) and the type in `thing_type_actual`, ordered by `position`. Reading a top-level `title` left
every resolved row showing "—".

**Add-by-URL is deliberately absent.** `/resolve` is a text resolver with no URL path. The web app's
add-by-URL uses `POST /ingestion/pre-flight`, which fetches and extracts the page — built for the
interactive one-URL-at-a-time flow, rate-limited and Redis-cached for that shape. Doing it here would mean
`pre-flight` → take the extracted title → `/resolve`, two calls per row. That's a feature, not wiring;
the backend offered a single combined endpoint if staff hit a real need for it.
(`GET /things/by-url` is *not* the answer — it's an exact lookup against Things already in the registry.)

**The type picker** reads `GET /types` (96 entries, public, no auth) — the same vocabulary
`isValidThingType()` validates against, so it cannot offer a type `POST /pitches` rejects. Two wrinkles:
the endpoint still returns the four retired types (`Cafe`, `Gym`, `Bar`, `Store`) with `supported: true`
and counts of 1–2, so they are filtered via `src/taxonomy.js` — offering them would manufacture the drift
the Taxonomy Health panel (#456) exists to detect. And it excludes five abstract parents that
`isValidThingType()` accepts, which is divergence in the safe direction. Options sort by `count`, deepest
registry first. There is no free-text escape hatch: with a live vocabulary, free text can only 400.

`/imports/parse` failures fall back to splitting pasted text one item per line, so a build can still
proceed by hand.

### What the matcher is actually asked

The row shows the pasted text; the matcher gets `queryFor(row).title`, which is not the same string.
Pasted blocks go through `tableQueries()` in `resolveAdapter.ts`, which reads the block as a whole
because the ambiguous parts of a table row cannot be read from one row: a leading integer is a rank in
`1 It 2017 $719,766,009 [1][2]` and the title in `28 Days Later`, and a trailing year is a column here
and part of the name in `Blade Runner 2049`. A rank column is only believed when most rows start with an
ascending integer *and* either the numbers step by one or the rest of the block carries money and
reference columns. Column headings — a first row with no rank where every item row has one — arrive
dropped, struck through, and one `x` puts them back.

Reference marks, currency amounts and footnote daggers are stripped per row regardless, since none of
them is ever part of a title.

### Discarding a build

A reload does not clear the builder — a draft is restored precisely so a reload can't destroy one — so
**Discard build** in the toolbar is the way out, shown only while there are unsaved changes. It confirms
first, then returns the list to the items the pitch actually holds (or empties it, if there are none) and
clears the draft. A pasted **Replace all & resolve** does the same thing in passing when the intent is to
start over from new text.

### Duplicates

Two checks, because they catch different things. Pasting again skips lines already on the list and says
how many — a build survives a reload now, so a re-paste lands on rows that are still there. Separately,
two rows that *resolved* to the same thing block the save the way a type mismatch does. Only the resolved
ids expose those; the text check cannot see them.

Both rows in a collision are named, with the film they landed on — not just the later one. The later row
is not reliably the wrong one: a mis-picked candidate on row 17 collided with the correct row 31, and
naming only 31 would have had the operator delete the film and keep the mistake. Deciding which match is
wrong needs both rows in view, so the strip offers a jump to the first and a drop of the rest, and does
not choose.

### Matches worth a second look

`matchConcern()` flags a resolved row whose match agrees with nothing on the line it came from: a title
sharing no word of three letters or more, or a year more than two out. Two years is deliberately the same
window the server's suggestion filter keeps (listgem-platform#564) — flagging inside it would only
contradict a judgement the server has already made.

The year rule is theirs exactly, both halves: **flagged only when both years are known and they disagree
by more than two.** A line with no year, or a match with no year, says nothing — so this says nothing. It blocks nothing — a real match
often shifts a year between a box-office table and the registry — but it colours the cell amber and lists
the row above the table.

It exists because the matcher offered *The Silence of the Lambs* (1991) as its **only** suggestion for
`Hannibal` (2001), and a single suggestion presented alone reads as the answer. The registry did not hold
Hannibal at the time; `no_confident_match` was the right verdict, and only the suggestion was wrong. Both disagreements were
already in the row. Verified against every resolved row of the 40-film build: one flag, no false ones.

### Ambiguous vs unresolved

A server `no_match` that ships suggestions is reported **ambiguous** — "not confident, you pick" — and
only a `no_match` with nothing to offer is unresolved. A suggestion is never adopted as the resolution
whichever way it is labelled. Before this split, three films in a 40-row build read as failures with the
correct match already sitting in their candidate lists. When a resolve goes wrong, **Copy diagnostics** reports `search_title` and
`search_year` beside `raw_text`; if those two are identical the cleaner did nothing, which is the first
thing to check.

## The guide rail

`pitchFlow.ts` resolves the pitch into an ordered list of steps — details, build, links, mark pitched,
send, they claim, confirm identity — each `done` / `current` / `blocked` / `waiting` / `todo`, derived
from server state only. `PitchFlowRail` renders it above the tabs and leaves them alone: it helps someone
who doesn't know the sequence without slowing down someone who does.

Three rules hold it together, and each exists because of a specific failure:

- **Exactly one step is live.** A rail that answers "what now" with two answers is not a rail. Pinned by
  a test that sweeps the realistic states.
- **`done` needs server evidence.** The build step reads `item_count`/`resolved_count`, so a builder full
  of unsaved rows does not tick it. Nothing records that an invite was *sent*, so that step ticks on the
  claim rather than pretending to know.
- **`waiting` needs evidence the ball is with them.** `pitched` only means we marked it pitched; calling
  that "waiting on them" would excuse an outreach nobody made. `accepted` is the target answering, so the
  wait is real.

Adding a step means adding it to `pitchFlow` and its test — not to a component. The resolver is pure for
the same reason `pitchRules` is: the sequence gets pinned by tests instead of by clicking through prod.

## Issuing tokens on a draft

Minting the token pair and the invite *working* are different questions. A preview on a draft is worth
having — reviewing the list before pitching is exactly when you want one — so `canIssueTokens` still
allows it. But a draft cannot be claimed: `GET /pitches/invite/:token` answers
`410 {"valid":false,"reason":"not_claimable_from_draft"}`, and the public signup page has no wording for
that reason, so the target sees only *"That invite link isn't usable."* — its fallback copy.

`inviteClaimBlockedReason()` mirrors the server so the panel says it first, on our screen instead of
theirs. **Move the pitch to Pitched before sending the invite.** Only states verified against prod are
named; an unrecognised status returns `null`, which means "nothing known against it", not "confirmed
fine".

## What the preview link exposes

`GET /pitches/preview/:token` is public and unauthenticated, and the link is forwardable, so its payload
is readable by anyone who ends up holding it. Verified against prod on 2026-08-25: no contact details, no
tokens, no `assigned_to`, no notes, no pitch status, and nothing resembling `verified_method`.

What it *does* carry is every inherited field — `target_name`, `target_org`, the proposed title and
description, `category`, `source_url` and `source_attribution` — plus each item's `raw_text`. Both intake
and edit mark these as target-visible, because nothing else in the form said so: an attribution typed as
`ew`, shorthand while entering a pitch, rendered to the target as “Compiled from ew.”

`raw_text` staying in the payload is worth knowing when pasting from a table — the page renders resolved
titles, but the pasted line (box-office columns, reference marks and all) is in the response behind it.

## Verifying against prod

Prod is the only environment, and this feature writes **real people's contact details**. Anything created
during a verification run is a real row in the real table, so:

- Prefer read paths on rows that already exist. Board, detail, tokens display and history all verify
  without creating anything.
- If a run needs a pitch of its own, finish with **takedown**, not archive. Archive leaves contact details
  on the record; takedown purges them and revokes both tokens. Same discipline the backend sessions have
  been using after their verification runs.
- A test verification grant is a badge on a real account — remove it with a reason rather than leaving it.
- Never paste a real contact into a fixture. `mockPitches.js` and `mockVerification.js` are invented people
  and `example.*` addresses, and should stay that way.

The portal has its own login and every endpoint here needs an admin JWT, so a session without prod
credentials can build these screens but cannot verify any of them against the live API — including the
three inferred shapes above. Confirm credentials before starting work that depends on live responses.

## Data handling

- `/pitches` and `/verification` send `Cache-Control: no-store`; the hooks mirror that with
  `staleTime: 0`, `gcTime: 30s`, no retry (`NO_STORE` in `api/hooks.js`).
- Every page keeps the repo's `usingSample ? MOCK : live` fallback. The sample fixtures
  (`mockPitches.js`, `mockVerification.js`) contain invented people and `example.*` contacts only — real
  contact details exist behind the live API and nowhere else in this repo.
- Takedown purges contact and revokes both tokens; the board renders a purged contact as "contact purged",
  never a stale value.
