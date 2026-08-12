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
| `thing_type` source | `/admin/type-rules` | Not a type vocabulary — 355 crawler URL-pattern rules on `detected_type`, still carrying retired types (Gym, Cafe, Bar, Store). The select uses a curated list |

Two consequences worth keeping in mind:

- **Every resolve needs a type.** `/imports/parse` returns `inferred_type`, usually `null`, so the builder
  falls back to the pitch's own `thing_type`. A pitch whose list mixes types will resolve the odd ones out
  under the wrong type — a per-row type override is the obvious follow-up if that shows up in practice.
- **`suggestions` must never be auto-adopted.** A `no_match` frequently ships exactly one suggestion.
  Promoting it would turn "we could not match this" into a silent, wrong link, so a lone candidate is only
  adopted when the server returned no verdict of its own. Pinned by a test.

Saved items are shaped differently again: no nested `thing`, with the resolved entity in `thing_metadata`
(title/year) and the type in `thing_type_actual`, ordered by `position`. Reading a top-level `title` left
every resolved row showing "—".

**Open question for the backend:** `/resolve` has no URL path, so the builder's add-by-URL control was
removed. If the web app's add-flow accepts URLs it must go through a different endpoint — worth asking
before rebuilding that affordance.

`/imports/parse` failures fall back to splitting pasted text one item per line, so a build can still
proceed by hand.

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
