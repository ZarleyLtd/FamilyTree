# FamilyTree (CursorSites)

A web app for viewing and collaboratively building a family tree. Designed for phones first, with an equally usable desktop layout. Shared with siblings and cousins via a secret link to **view**; people the admin invites **register** with a handle and password so they can edit from any device.

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
- **Editing** is a person identity, not a device: the admin issues a one-time invite code; the person registers (handle + display name + password) and later connects on any device with handle + password. Sessions expire; the admin can issue a reset code if a password is forgotten.
- Living persons' details are only shown to devices that hold the share code.

## Documents

| Doc | Purpose |
|-----|---------|
| [docs/PLAN.md](docs/PLAN.md) | Development plan, phases, decisions |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Schema design for `familytree` |
| [docs/api-contract.md](docs/api-contract.md) | `familytree-api` actions |
| [docs/runbook.md](docs/runbook.md) | Deploy / migrate / smoke test |
| [docs/UI_BRIEF_MESSAGE.md](docs/UI_BRIEF_MESSAGE.md) | Brief-message UI pattern (synced) |
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
