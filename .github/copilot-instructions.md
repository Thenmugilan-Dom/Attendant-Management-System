## Quick context for AI coding agents

- Stack: Next.js 15 (app router), React 19, TypeScript, Tailwind CSS, Supabase (Postgres), Nodemailer for Gmail SMTP.
- Repo layout: top-level `app/` (pages), `api/` routes under `app/api` and `app/api/*` endpoints, `components/` for UI, `lib/` for clients/utilities. See `README.md` for full flow.

## What matters most (fast summary)

- Primary data store: Supabase. Supabase client: `lib/supabase.ts` — use `supabase.from(...).select(...)` and follow existing patterns for relationship selects (e.g. `classes (id, class_name)`).
- Auth model: client-side localStorage `user` object + role checks in client components (many pages use `useEffect` to read `localStorage` and redirect). Middleware (`middleware.ts`) only sets cache-control for protected routes; it does NOT authenticate.
- Critical table: `teacher_subjects` — teachers see assignments only if this table has rows. Many bugs stem from missing assignments.
- DB setup: run the master SQL file in README (search for `DATABASE_SETUP_COMPLETE.sql` or `MASTER_DATABASE_SETUP.sql`).

## Dev / build / run commands

- Install: `npm install`
- Dev: `npm run dev` (runs `next dev --turbopack`).
- Build: `npm run build`.
- Start (prod): `npm run start`.
- Lint: `npm run lint`.

Notes: `next.config.ts` sets `ignoreDuringBuilds` and `ignoreBuildErrors` — CI/builds may intentionally allow TypeScript/ESLint warnings.

## Environment & secrets (important keys)

- `.env.local` required keys:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - GMAIL_USER
  - GMAIL_APP_PASSWORD

Open `lib/supabase.ts` to see how the client is created and to find the exact env var names.

## Patterns and conventions agents should follow

- Component conventions: many files are client components—look for "use client" at top. Client pages do auth checks via `localStorage` and call Supabase in `useEffect`.
- Supabase queries: prefer the existing `.select(`...`)` with nested relationship syntax and `.eq(...)` style filters. When transforming results, code expects nested objects like `assignment.classes.class_name` or `session.classes.class_name`.
- Error handling: current pattern uses `console.error(...)` + user-facing `alert(...)`. Preserve that style when adding fixes unless adding structured logging.
- UI components: reuse `components/ui/*` primitives (Button, Card, Dialog, Input). Keep visual parity.
- Path alias: `@/*` maps to repo root — use it in imports (`@/lib/supabase`, `@/components/...`).

## Integration points to be careful with

- Supabase (DB) — queries, RLS, and schema changes affect many pages.
- Email (Nodemailer/Gmail App Password) — OTP flow depends on working SMTP in `.env.local`. Development mode may log OTPs to console.
- QR scanning libraries (`html5-qrcode`, `@zxing/library`) and `react-qr-code` — changes to scanner behavior need testing on mobile.

## Files to open first for context

- `README.md` — comprehensive feature & flow doc (start here).
- `lib/supabase.ts` — supabase client and DB types.
- `app/teacher/page.tsx` — shows teacher flows, supabase selects, and session lifecycle.
- `app/students/` and `app/login/page.tsx` — student QR/OTP flows and auth.
- `middleware.ts` — route matching and caching behavior.
- `DATABASE_SETUP_COMPLETE.sql` or `MASTER_DATABASE_SETUP.sql` — DB schema and critical triggers/indexes.

## Small examples to copy when changing behavior

- Fetch assignments (copy pattern):
  const { data, error } = await supabase.from('teacher_subjects').select(`
    id, class_id, subject_id, classes (id, class_name, section), subjects (id, subject_name, subject_code)
  `).eq('teacher_id', teacherId)

- Create session (pattern used in `app/teacher/page.tsx`): insert into `attendance_sessions` and `.select(...)` with related `classes`/`subjects` in the same call.

## Editing & testing tips

- Run `npm run dev` locally; verify QR + OTP flows on a phone (HTTPS may be required for camera in some browsers — use a device on the same network or deploy to Vercel for end-to-end tests).
- If changing DB schema, update the SQL master file and include migration steps. Many pages assume fields like `session_code`, `expires_at`, `student_id` exist.
- For auth changes: remember middleware does not read localStorage; keep client-side role checks in pages.

## When to ask the human

- If a change requires enabling Row Level Security (RLS) or altering the DB schema beyond adding nullable columns, ask before proceeding.
- If email credentials or Supabase project details are needed, request the `.env.local` values (do not request secrets in chat; ask how the user prefers to provide them).

---

If you want, I can refine any section or add quick code snippets for common tasks (e.g., adding a new API route, or a safe supabase query example with error handling). Which section should I expand? 
