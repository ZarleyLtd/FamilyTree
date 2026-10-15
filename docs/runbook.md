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

## First tree

After the schema migration, insert the first tree row (SQL editor or `execute_sql`), choosing a share code and hashing the contributor/admin codes the same way the Edge Function does (documented in the function header). Then open `index.html?t=<share code>`.

## Frontend

Static files; `npx serve .` locally or GitHub Pages (`main`, root). Relative paths only.

## Smoke test (per phase)

1. Open the site without `?t=` → landing page only, no personal data.
2. Open with `?t=<code>` → tree home loads; reload without the query string still works (code stored).
3. Register as contributor with the contributor code → add a person with an approximate birth date → appears in People and Recent changes.
4. Add a parent and a partner → pedigree shows them; tap to recentre.
5. (Phase 2) Upload a photo from a phone → appears on profile and in Gallery, file ≤ 150 KB in Storage.
6. Check both at 360px wide (devtools phone emulation or a real phone) and at desktop width.
