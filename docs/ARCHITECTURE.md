# FocusFlow — architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript, Vite | Fast SPA; Supabase provides the backend, so no app server is needed |
| Styling | Tailwind CSS v4, CSS variables for light/dark tokens | One token set, themeable, no runtime CSS-in-JS |
| Primitives | Radix UI (dialog, dropdown, tabs, alert dialog) | Accessible focus management and keyboard support |
| Server state | TanStack Query | Caching, optimistic updates, rollback, refetch on focus |
| Forms | react-hook-form + zod | Typed schemas shared by validation and payload building |
| Charts | Recharts with a validated, colorblind-safe palette | |
| Export | jsPDF + autotable, ExcelJS (both lazy-loaded) | Generated in the browser; nothing leaves the account |
| Backend | Supabase Auth, Postgres (RLS), Storage | |

## Folder layout

```
src/
  App.tsx                 routes, guards, providers
  lib/                    supabase client, query client, dates, errors, utils
  providers/              auth, theme, confirm-dialog
  types/database.ts       typed schema (mirrors the migration)
  components/
    ui/                   Button, Input/Select/Field, Dialog, Menu/Tabs/Segmented, Card/Badge/Progress/Empty/Stat
    layout/               AppShell (sidebar, top bar, mobile drawer), CommandPalette, nav
    shared/charts.tsx     bar/line charts, progress rows, segment bar, ring
  features/
    items/                planner item domain: category registry, zod schema, API hooks, selectors, row, form dialog
    planner/              list (agenda buckets), board (drag & drop), calendar
    dashboard/            dashboard page
    academics/            subjects → units → concepts: API, tree/progress, dialogs, pages
    career/               career tabs, skills & achievements
    files/                storage upload/sign/delete, attachments, files page
    stats/                pure statistics engine + statistics page
    export/               dataset builders, PDF & Excel renderers, export page
    settings/             profile & account
supabase/migrations/      SQL schema, RLS, storage bucket + policies
dev/local-supabase/       local emulator (PGlite) + demo seed — development only
tests/                    DB/RLS tests (PGlite) and API integration tests (emulator)
```

Each feature owns its data hooks (`api.ts`), pure logic (tested), and UI. Pages
compose feature components; nothing below `features/` imports a page.

## Data model

```
auth.users ─┬─ profiles (1:1, created by trigger on signup)
            ├─ subjects ── units ── concepts
            ├─ items  (tasks, tests, labs, assignments, projects, hackathons,
            │          events, internships, DSA, aptitude, certifications, custom)
            ├─ skills
            ├─ achievements ── (optional) items
            └─ files ── (optional) subject / unit / concept / item
                    └── storage.objects in bucket "user-files" at <user_id>/<folder>/<uuid>-<name>
```

### Why one `items` table?

The planner, calendar, dashboard, career tracker, statistics and exports all
need the same things: title, category, dates, status, priority, progress,
notes, tags. A single table keeps them consistent and makes cross-cutting
views (e.g. "everything due this week") a filter instead of a union.
Category-specific fields (company, issuer, difficulty, repo URL, …) live in
`details jsonb`, validated in the app by a schema derived from the category
registry in `features/items/config.ts`. Adding a category = one registry entry
plus an enum value.

### Integrity & isolation

- **RLS on every table**: `auth.uid() = user_id` for select/insert/update/delete.
  `user_id` defaults to `auth.uid()`, so clients never send it.
- **Composite foreign keys** `(parent_id, user_id) → parent(id, user_id)` make it
  impossible to attach a row to another user's parent, even with a guessed id.
- `on delete set null (col)` (Postgres 15+) unlinks files/items when a subject,
  unit, concept or item is deleted without touching `user_id`.
- `files.storage_path` must start with the owner's id (check constraint), and
  Storage policies restrict objects to the `<uid>/` prefix of a **private** bucket.
  Files are served through short-lived signed URLs.
- Triggers maintain `updated_at`, and `completed_at`/`progress` on completion,
  so statistics can't be skewed by client clocks.
- `anon` has no table privileges at all.

These guarantees are verified in `tests/db/schema.test.ts` (Postgres via PGlite).

## Client data flow

- Each dataset (items, academics, files, skills, achievements, profile) is one
  TanStack Query cache entry, paged past PostgREST's 1000-row cap (`fetchAll`).
- Mutations patch the cache directly; frequent actions (complete, status change,
  concept status) are optimistic with rollback on error.
- Signing out clears the whole cache, so one user's data never shows for the next.
- Derived views (dashboard, stats, exports) are pure functions in
  `features/stats/compute.ts`, `features/items/selectors.ts`,
  `features/academics/tree.ts` and `features/export/datasets.ts` — all unit-tested.

## Scaling notes

The client holds a user's full dataset in memory, which is comfortable into the
tens of thousands of rows for a single student. If that changes, the query hooks
are the only place that needs server-side filtering/pagination — the pages
consume hooks, not Supabase directly.
