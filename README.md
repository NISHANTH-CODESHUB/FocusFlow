# FocusFlow

FocusFlow is an all-in-one academic and career platform helping students plan, organize, and track tests, labs, assignments, projects, hackathons, internships, DSA, aptitude, certifications, and learning goals. It offers progress analytics, study material organization, secure file storage, reminders, and PDF/Excel exports in one workspace.

Built with React + TypeScript + Tailwind on Supabase (Auth, Postgres with Row
Level Security, Storage). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for
the design and data model.

## Features

- **Dashboard** — today's work (overdue included), upcoming tests/labs/assignments,
  deadlines with priority, career pipeline, DSA & aptitude progress, certifications
  and learning goals, academic progress, revision reminders, productivity chart, streaks.
- **Planner** — tasks, tests, labs, assignments, projects, hackathons, events,
  internships, DSA, aptitude, certifications and custom activities; each with
  description, priority, status, dates, progress, notes, tags, category-specific
  details and attachments. List (agenda), Board (drag & drop) and Calendar views,
  search, filters and sorting.
- **Academics** — subjects → units → concepts, Not started / Learning / Completed,
  notes, resource links, revision dates, study materials at subject/unit/concept
  level, completion percentages. Paste a syllabus list to add many concepts at once.
- **Career** — DSA (topic/difficulty/platform), aptitude (sections, mock scores),
  certifications, projects, internship pipeline, hackathons & events, skills,
  achievements.
- **Statistics** — completion rates, productivity over 7/30/90 days or 12 months,
  added-vs-completed trend, per-category, academic, DSA, aptitude, project and
  certification progress, upcoming deadlines.
- **Files** — private storage organized in folders (certificates, academic,
  study, projects, resume, important, other), linked to subjects, units,
  concepts, tasks, projects or certifications.
- **Export** — PDF report or Excel workbook (one sheet per section) with presets
  and date filters.
- **AI assistant** ("Ask AI" in the top bar) — answers questions about your
  tasks, deadlines, subjects and prep, builds study plans and explains topics.
  Runs on Groq's free tier (`openai/gpt-oss-120b`) through a server function, so
  the key stays private; it reads your data with your own login (RLS applies)
  and cannot change anything.
- Global search (`Ctrl/⌘ K` or `/`), quick add (`N`), light/dark/system theme,
  responsive layout with a mobile drawer and bottom-sheet dialogs.

## AI assistant setup (free)

1. Create a free key at [console.groq.com/keys](https://console.groq.com/keys)
   (no credit card). Optionally enable **Zero Data Retention** under
   *Settings → Data Controls*.
2. Add `GROQ_API_KEY` — **without** a `VITE_` prefix, so it never reaches the
   browser — to Vercel (*Settings → Environment Variables*, then redeploy) and,
   for local development, to `.env.local`.
3. The function lives in `api/chat.ts` (logic in `server/chat/`). `npm run dev`
   serves it locally through a small Vite middleware.

Free-tier limits are shared by everyone using your deployment (roughly 1,000
requests and 200K tokens per day); the assistant shows a friendly message when
they are reached.

## Setup with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run
   [`supabase/migrations/20260927000000_initial_schema.sql`](supabase/migrations/20260927000000_initial_schema.sql).
   This creates the tables, RLS policies, triggers and the private `user-files`
   storage bucket with its policies.
   (With the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Authentication → URL configuration**: set the Site URL to where the app runs
   (e.g. `http://localhost:5173`) and add `<site>/reset-password` to redirect URLs.
   Email confirmation can stay on — the app shows a "check your inbox" screen.
4. Copy `.env.example` to `.env.local` and fill in **Project URL** and **anon
   public key** (Settings → API).
5. Install and run:

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

Build for production with `npm run build` (output in `dist/`).

## Deploy to Vercel

`vercel.json` configures the Vite build, client-side routing and caching headers.

1. In Vercel, **Add New → Project** and import this GitHub repository
   (framework preset: Vite — detected automatically).
2. Under **Environment Variables** add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` for Production (and Preview if you use it).
   Vite inlines them at build time, so redeploy after changing them.
3. Deploy. Every push to `main` then redeploys automatically.
4. In Supabase **Authentication → URL configuration**, set the Site URL to your
   Vercel domain and add `https://<your-domain>/reset-password` to redirect URLs.

## Try it locally without a Supabase project

A local emulator (`dev/local-supabase/`) runs the real migration in an embedded
Postgres (PGlite) and speaks the subset of the Supabase auth/REST/storage APIs
the app uses, with RLS enforced. It is for development and demos only.

```bash
npm run local:backend
```

```bash
npm run local:seed
```

```bash
npm run dev:emulator
```

Sign in with the demo account `demo@focusflow.test` / `Student123` (emulator
only). Data persists in `.local-supabase/`; `npm run local:backend:reset` wipes it.

## Tests

```bash
npm test
```

- `tests/db` — applies the migration to Postgres (PGlite) and checks RLS
  isolation, cross-user foreign-key forgery, anonymous denial, triggers,
  cascades and storage path policies.
- `tests/integration` — drives the emulator through the real `supabase-js`
  client: sign-up/sign-in, CRUD, two-user isolation, storage upload → signed
  URL → download → delete.
- `src/**/*.test.ts` — statistics, selectors, academic progress, export datasets,
  PDF/Excel rendering.

`npm run typecheck` runs the TypeScript compiler.

## Notes & limitations

- PDF export uses jsPDF's built-in fonts (Latin-1): common symbols (Greek
  letters, arrows, ≤/≥, ₹) are transliterated, other scripts appear as `?`.
  The Excel export keeps full Unicode.
- Account deletion requires a server-side function with the service role and
  is not included; users can delete their data from within the app.
