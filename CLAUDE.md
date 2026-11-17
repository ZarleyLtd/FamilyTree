# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Collaborative family tree viewer/editor. Phone-first, desktop-equal. Static multi-page site (HTML + plain CSS + vanilla JS, no build step) plus Supabase Edge Function `familytree-api`. Hosted on GitHub Pages from `main` (root): https://zarleyltd.github.io/FamilyTree/. Same shape as BGS, Scrabble and theConfessional.

Key docs: `docs/PLAN.md` (scope/phases), `docs/DATA_MODEL.md` (schema), `docs/api-contract.md` (API actions), `docs/runbook.md` (deploy/migrate/smoke test).

## Dev server / port

```powershell
npx serve .
```

Serves on **http://localhost:3000**. Open `http://localhost:3000/index.html?t=<share code>` — without the share code only the landing page shows. `serve.json` sets `cleanUrls: false` so query strings survive. The frontend talks to the deployed `familytree-api` (URL in `assets/js/config/app-config.js`).

## Commands

```powershell
node --test tests/                         # all unit tests
node --test tests/gen-date.test.mjs        # single test file
supabase migration new <snake_name>        # new migration file (then apply via MCP, see below)
supabase functions deploy familytree-api --no-verify-jwt
```

## Architecture

- **JS modules:** `assets/js/config/app-config.js` (`FAMILYTREE_CONFIG.API_URL`, bucket URL base, limits) → `utils/` (`api.js`, `tree-access.js` share code + session token, `gen-date.js` fuzzy dates, `kinship.js` relationship calculator, `image-compress.js`, `brief-message.js`, `confirm-dialog.js`, `help-catalog.js`, `layout-*.js`) → `components/` (person card/picker, event editor, media uploader, lightbox, pedigree/descendants/fan charts, timeline, change log, contextual help) → `pages/` (one module per HTML page with `init()`) → `main.js` routes by `document.body.dataset.page`.
- **Script loading order:** config → utils → components → pages → main.js. No duplication between pages — common code lives in utils/components.
- **HTML components:** shared header/nav/footer in `components/*.html` are pasted into each page. Update the component file first, then propagate to every page.
- **PWA:** `manifest.json` + `sw.js` (shell cache `familytree-shell-vN`). When adding/renaming shell assets update the `SHELL` list and bump the cache name.
- **Charts are hand-rolled SVG** (no D3/library). Keep layout code pure (data in → node positions out) in `assets/js/utils/layout-*.js` so it's unit-testable with `node --test`.
- **API calls:** GET with no custom headers, or POST with `Content-Type: text/plain;charset=UTF-8` and a JSON string body (avoids CORS preflight; same as Scrabble/theConfessional). Responses are `{ error: string|null, data: any }`.

## Rules

1. **Relative paths only** (`assets/css/style.css`, not `/assets/...`). Never embed `http://localhost` or drive letters.
2. **Both form factors:** every view must work at 360px wide (touch) and 1280px+ (mouse). Charts need pan/zoom by touch and by wheel/drag.
3. **Access:** every API call carries the tree share code; mutations also carry the session token (issued at register/connect). The server is the authority — the browser never decides what is private. Passwords, invite codes and session tokens are hashed server-side; never log them.
4. **Living persons:** never render birth dates/places or other private details of a living person unless the server returned them.
5. **Attribution:** every mutation writes a `change_log` row (`actor_id` + display name at the time, before/after JSON). Never bypass. Identity is the `contributors` row, not a device.
6. **Genealogy dates are fuzzy:** store `date_text` (as typed), `date_sort` (approx, for ordering), `date_qualifier`. Use `GenDate` helpers; never `new Date(text)` on user dates.
7. **Soft delete:** persons, families, events, media use `deleted_at`; no hard deletes through the API except admin purge.
8. **Images:** compress in the browser with `ImageCompress.compressToTarget` (~100 KB JPEG) before sending base64. Never upload originals.
9. **Multiple trees:** every table has `tree_id`; the UI is single-tree for now but never hard-code a tree.

## Shared CursorSites UI patterns

- **Brief message:** canonical spec `../cursor-sites-shared/ui/BRIEF_MESSAGE.md`, synced via `../cursor-sites-shared/scripts/sync-ui.ps1`. `BriefMessage.show(text, anchorEl, options)` in `assets/js/utils/brief-message.js`, styles `assets/css/brief-message.css`.
- **Contextual help (this app is the reference):** spec `../cursor-sites-shared/ui/CONTEXTUAL_HELP.md` (not synced — the catalog is app copy). Engine `ContextualHelp.init()` in `assets/js/components/contextual-help.js`, styles `assets/css/contextual-help.css`, catalog `assets/js/utils/help-catalog.js`. Mark controls with `data-help`; the **?** button is `data-help-toggle`. Help copy explains the feature, never a particular record.

## Shared Supabase database — IMPORTANT

This app shares Supabase project **Apps** (`yzyipxvlsoxfphwobfkb`) with other CursorSites apps. Our schema is `familytree`, our Storage bucket is `familytree` (RLS on, no anon policies — all access via the Edge Function). The migration history table is **global**.

- **Never run `supabase db push`**, and never repair/revert other apps' remote migration versions to unblock it.
- Schema change: write SQL touching only the `familytree` schema (and the `familytree` row in `storage.buckets`) → `supabase migration new <name>` and put the SQL in it → apply the same SQL with MCP `apply_migration` on project `yzyipxvlsoxfphwobfkb` (schema-qualified) → verify with `execute_sql` → commit the migration file.
- Edge Function deploys (`supabase functions deploy familytree-api --no-verify-jwt`) are independent of migration history.
- Full write-up: `../cursor-sites-shared/supabase/SHARED_DATABASE.md`.
