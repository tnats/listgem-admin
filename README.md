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
    ├── moderation/   # Report queue, user mgmt (Phase 2)
    ├── quality/      # Quality metrics (Phase 3)
    ├── pipeline/     # Crawl monitor (Phase 3)
    └── settings/     # System config (Phase 4)
```

## Related

- [listgem-platform](https://github.com/tnats/listgem-platform) — Backend API
- Admin portal issues: `admin-portal` label
