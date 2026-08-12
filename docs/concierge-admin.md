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

## Assumptions worth confirming against the live API

The issue pins `/pitches` and `/verification` exactly; these three are inferred and read defensively, so a
mismatch degrades rather than crashes. Worth a look on first live use:

1. **`/resolve` and `/resolve/batch` response shape.** The issue says batch elements are "`/resolve`'s
   response plus `index`" without giving that shape. `resolveAdapter.normalizeResolution` accepts
   `status`/`resolution_status`, `thing_id`/`thing`/`match`, and `candidates`/`matches`/`results`, and
   derives a status when none is sent. A row is never marked `resolved` without a `thing_id`.
2. **`/resolve/batch` request shape.** Sent as `{ items: [{ position, raw_text }] }` — the shape
   `/imports/parse` returns.
3. **`thing_type` vocabulary.** The intake select prefers live `/admin/type-rules`; when that yields fewer
   than three distinct types it falls back to a PascalCase list in `pitchRules.FALLBACK_THING_TYPES`, with
   an "Other…" free-text escape hatch. `POST /pitches` 400s on an invalid type.

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
