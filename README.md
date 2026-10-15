# FamilyTree (CursorSites)

A web app for viewing and collaboratively building a family tree. Designed for phones first, with an equally usable desktop layout. Shared with siblings and cousins via a secret link (no accounts), so the family can populate the tree together over time.

Live site (GitHub Pages): https://zarleyltd.github.io/FamilyTree/

## Stack

Same shape as the other CursorSites apps (BGS, Scrabble, theConfessional):

- **Frontend:** static HTML + plain CSS + vanilla JS, no build step. Multi-page (`index.html`, `people.html`, `person.html`, `tree.html`, `gallery.html`, `admin.html`).
- **Backend:** Supabase Edge Function `familytree-api` (service role) on the shared CursorSites **Apps** project (`yzyipxvlsoxfphwobfkb`).
- **Database:** Postgres schema `familytree` (RLS on, no anon policies – all access goes through the Edge Function).
- **Media:** Supabase Storage bucket `familytree` – photos compressed in the browser to low-res JPEG before upload (BGS gallery pattern).
- **Hosting:** GitHub Pages from `main` (root).

## Access model

- A tree has a secret **share code**. Opening `index.html?t=<CODE>` once stores it on the device; without it the site shows only a landing page.
- A separate **contributor code** unlocks editing. Entering it once registers the device (display name + token) so every change is attributed in the change log.
- Living persons' details are only shown to devices that hold the share code.

## Documents

| Doc | Purpose |
|-----|---------|
| [docs/PLAN.md](docs/PLAN.md) | Development plan, phases, decisions |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Schema design for `familytree` |
| [docs/api-contract.md](docs/api-contract.md) | `familytree-api` actions |
| [docs/runbook.md](docs/runbook.md) | Deploy / migrate / smoke test |
| [.cursorrules](.cursorrules) | Project conventions for AI-assisted editing |

## Local development

```bash
npx serve .
```

Then open `http://localhost:3000/index.html?t=<share code>`.

## Deploy (backend)

See [docs/runbook.md](docs/runbook.md). Short version:

```bash
supabase migration new <snake_name>        # then apply via MCP apply_migration – never db push
supabase functions deploy familytree-api --no-verify-jwt
```
