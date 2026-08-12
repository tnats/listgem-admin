# Admin plan — Concierge Pitch Lists (#434) + User Verification (#435)

Scoping for the next admin build cycle. Source issues in `tnats/listgem-platform`:
**#434** (Concierge Pitch Lists) and **#435** (identity-authenticity verification), a linked
"concierge acquisition + trust" pair aimed at the cold-start problem.

> **How this differs from the 2026-07 cycle.** That cycle was mostly *read-only metrics endpoints +
> admin render* — small backend, small admin. This one is **backend-heavy**: new staging tables, a
> provisioning transaction, invite/preview tokens, and a verification model. The admin portal is the
> *operator surface* on top of that — the smaller slice. Critical path is backend, and it is gated
> upstream by **#433**. Expect multi-week, not multi-day.

---

## Dependency graph (read this first)

```
#433 Import a List  ──(parser + ER/KG resolve)──►  #434 build step   [#433 is OPEN/unbuilt — the gate]
#338 Publish-promo  ──(CLOSED)──►                  target self-publishes after provisioning (not admin)
#434 Concierge      ──(grant verified at provision)──►  #435 Phase 1  [near-dependency; ship together]
/moderation (exists) ──(impersonation reports/takedown)──►  #435
#183 curator weighting  ──  DECOUPLED (verification is display-only, never ranking)
```

**Consequences:**
- The #434 **build UI** (paste/URL → resolve) cannot function until **#433's parser/resolve exists**.
  Everything else in #434 (intake, outreach board, tokens, provisioning) does *not* depend on #433 and
  can proceed in parallel.
- **#435 Phase 1 ships with #434** — the pitch handoff grants `verified (method=concierge)`. Build them
  as one cycle.
- The **accept/provision path is backend + signup (main frontend)**, not admin — the admin only *builds
  the draft and generates the invite*. Keep that boundary clear.

---

## Recommended sequencing

1. **Confirm/land #433's parser + ER/KG resolve** (upstream, likely its own effort). Until then, #434's
   build step is stubbed.
2. **Backend, in parallel:** #434 staging tables + admin API + provisioning + tokens; #435 verification
   model + admin verify API. (Both already have detailed "Backend design" sections in-issue — the backend
   team can build from those; see "Backend asks" below for what admin specifically needs exposed.)
3. **Admin UI, as each backend piece lands:** intake → outreach board → build → tokens; verify/unverify
   tool + provisioning hook + impersonation queue.
4. **#435 Phase 2 (self-serve cross-link)** — fast-follow, mostly main-frontend + a backend checker;
   minimal admin role (review claims).

---

## Admin work items

Effort: S ~½ day · M ~1–2 days · L ~3–5 days · XL > 1 week. All need backend unless noted.

### #434 Concierge Pitch Lists — a new `/pitch` concierge surface

| # | Item | Backend dependency | Effort |
|---|------|--------------------|--------|
| P1 | **Target intake** — form (name/org/contact/source URL) → create pitch target | `pitch_lists` CRUD (admin-gated) | S |
| P2 | **Outreach board** — kanban by status (identified/built/pitched/accepted/declined/archived) + contact + notes | outreach-board query + status transitions | M |
| P3 | **Build UI** — paste text / URL → parse → ER/KG resolve → review/edit items + type/category (reuse #433 dialogs) | build endpoint reusing **#433** (the gate) + `pitch_list_items` | L |
| P4 | **Preview + invite links** — generate tokenized read-only preview + draft-scoped invite link | token endpoints (preview_token, invite_token) | S |
| P5 | **Archive / re-pitch / takedown** — takedown archives draft + **purges contact info** (data hygiene) | status transitions + purge | S |

- **Boundary note:** invite → signup → auto-provision is backend + main-frontend signup, not admin. Admin
  ends at "generate invite link." Surface provisioned/declined status on the board (read-only).
- **Build-now (no backend):** P2 (outreach board) and P1 (intake) UIs can be prototyped against a seeded
  sample (the admin app's standard live-or-mock fallback pattern), ready to wire when the API lands.

### #435 User Verification — admin verify tooling (Phase 1 ships with #434)

| # | Item | Backend dependency | Effort |
|---|------|--------------------|--------|
| V1 | **Verify / unverify tool** — set `verified_type` + `verified_method` + evidence note; unverify with reason; full audit trail | user verification fields + admin verify/unverify API | M |
| V2 | **Provisioning hook** — offer "grant verified (concierge)" in the #434 accept/handoff | provisioning grants verified | S (rides on #434) |
| V3 | **Impersonation review queue** — reuse existing `/moderation` infra for identity disputes + takedown | report + takedown (mostly exists) | S |
| V4 | **Phase 2 (fast-follow)** — review self-serve `rel=me`/domain claims | `verification_claims` + checker (mostly main-FE) | S (admin part) |

- **Guardrails baked into the issue (respect them):** never self-asserted; revocation with reason +
  audit; display-only (**zero** ranking effect); no paid tiers, no expertise tiers.

---

## Backend asks (what admin needs exposed)

Both issues already carry detailed "Backend design" sections, so the backend team can largely build from
#434/#435 directly. The admin-specific exposures to confirm as a hand-off (mirroring #476):

- **#434:** admin-gated CRUD on `pitch_lists`/`pitch_list_items`; a build endpoint (reuse #433 parse +
  resolve) returning per-item `resolution_status`; token generation (preview + invite); status-transition
  endpoints; the outreach-board query (list by status + contact/notes).
- **#435:** `verified` object on user/curator responses; admin verify/unverify endpoints with audit;
  the provisioning-time grant; impersonation-report surfacing via `/moderation`.
- **Gate:** #433's parser/resolve must be callable server-side for #434-P3.

**Open product questions to resolve before build** (from the issues — not admin's call alone): invite
token capability-vs-email-match + expiry; published-list provenance credit; re-pitch-from-archive in v1?;
per-staff vs shared pitch workspace; org-verification authorization; Phase-2 proof strictness.

---

## What the admin team can start now
- **Prototype the two highest-value UI shells against seeded samples** — the #434 **outreach board**
  (P2) and the #435 **verify/unverify tool** (V1) — using the existing live-or-mock fallback pattern, so
  they're ready to wire the moment the APIs land. Neither needs backend to design/review.
- **Not** the #434 build UI (P3) — it's gated on #433; don't start it until the parser is real.

## Recommendation
Treat #434 + #435-Phase-1 as **one cycle**, backend-led. Admin starts by prototyping the outreach board
(P2) and verify tool (V1) against mocks now; wires them + the token/intake flows as the backend lands;
the #433-gated build UI (P3) comes last. Phase 2 verification is a fast-follow. This is a materially
larger effort than 2026-07 — plan it as a mini-epic, not a backlog sweep.
