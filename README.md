# ListGem Admin Portal

Platform operations dashboard for ListGem. Separate from the user-facing app.

## Stack

- React + Vite
- Tailwind CSS
- TanStack Query
- React Router

## Setup

```bash
npm install
cp .env.production .env    # edit VITE_API_URL for local dev
npm run dev                # http://localhost:5174
```

Requires an admin user on the backend (`is_admin = true` in users table).

## Build

```bash
npm run build   # outputs to dist/
npm run preview # preview production build
```

## Tests

```bash
npm test         # vitest, single run
npm run test:watch
```

Vitest + Testing Library (jsdom). The suite is deliberately narrow: it pins the
invariants that a UI can quietly break on surfaces handling real people's
contact details and drafts that must never become public — re-pitch gating on
`can_repitch`, required verification evidence, identity confirmed only after a
claim, takedown as a single action, `verified_method` never rendering, and one
badge with no tiers. See `docs/concierge-admin.md`.

## Project Structure

```
src/
├── api/          # Axios client + TanStack Query hooks
├── auth/         # Login, JWT, route guards
├── components/   # Shared UI (Sidebar, StatCard, StatusBadge, etc.)
└── pages/
    ├── dashboard/    # Analytics overview
    ├── seeding/      # Registry seed management
    ├── worker/       # Worker health + queue stats
    ├── concierge/    # Pitch outreach board, builder, tokens (#434/#533)
    ├── moderation/   # Report queue, user mgmt, verification (#435)
    ├── quality/      # Quality metrics (Phase 3)
    ├── pipeline/     # Crawl monitor (Phase 3)
    └── settings/     # System config (Phase 4)
```

## Related

- [listgem-platform](https://github.com/tnats/listgem-platform) — Backend API
- Admin portal issues: `admin-portal` label
