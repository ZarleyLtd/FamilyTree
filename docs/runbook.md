# FamilyTree runbook

## Prerequisites

- Supabase CLI logged in and linked to the shared CursorSites **Apps** project (`supabase link --project-ref yzyipxvlsoxfphwobfkb`)
- Edge secrets already set on the project (shared with the other apps): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- GitHub CLI logged in as `ZarleyLtd`

## Database

This app shares the Apps project with other CursorSites apps (separate schemas; global migration history). Follow `../cursor-sites-shared/supabase/SHARED_DATABASE.md`:

1. `supabase migration new <snake_name>` and edit the new file under `supabase/migrations/` (SQL must stay in schema `familytree` / bucket `familytree`).
2. Apply with the Supabase MCP `apply_migration` tool (or the SQL editor) — **not** `supabase db push`.
3. Verify with `execute_sql`; commit the migration file.

## Edge Function

```bash
supabase functions deploy familytree-api --no-verify-jwt
```

Confirm `assets/js/config/app-config.js` → `API_URL = https://yzyipxvlsoxfphwobfkb.supabase.co/functions/v1/familytree-api`.

## Hashing (Edge Function)

Keep this in sync with the header comment on `supabase/functions/familytree-api/index.ts`:

- **Passwords** and the **admin unlock code**: bcrypt (bcryptjs, cost 10).
- **Invite / reset codes** and **session tokens**: SHA-256 hex of the normalized plaintext (codes uppercased; handles lowercased).
- **Share codes** are stored in plaintext (they are the view secret, like a document link). Generated from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

## First tree

Open the site **without** a `?t=` code. If the API reports no trees, the landing page offers **Create the tree**. That calls `bootstrapTree` and shows the share code, admin code, and first-register invite **once**. Copy them somewhere safe.

The first person to **Register** with that invite becomes `admin`. Then open `index.html?t=<share code>` (also stored in `localStorage` after you open it once).

## Frontend

Static files; `npx serve .` locally or GitHub Pages (`main`, root). Relative paths only.

## Smoke test (per phase)

1. Open the site without `?t=` → landing page only, no personal data.
2. Open with `?t=<code>` → tree home loads; reload without the query string still works (code stored).
3. Register as a contributor with a one-time invite (handle + password) → Connect on a second browser/profile with the same handle → add a person with an approximate birth date → appears in People and Recent changes, attributed to that handle.
4. Add a parent and a partner → pedigree shows them; tap to recentre.
5. (Phase 2) Upload a photo from a phone → appears on profile and in Gallery, file ≤ 150 KB in Storage.
6. Check both at 360px wide (devtools phone emulation or a real phone) and at desktop width.
7. (Phase 3) Tree page: Ancestors, Descendants (collapse a branch), Hourglass, Fan (180°/360°, tap a sector to recentre). Pan, pinch or wheel, fit, and recentre. On a profile, "How am I related?" after "This is me" on someone else. Home shows statistics and "On this day". People → Surnames jumps into that name. Share copies a link that includes `?t=`.
