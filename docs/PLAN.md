# FamilyTree – development plan

_Last updated: 2026-10-18 (Phase 0 implemented)_

## 1. Goal

A phone-first, desktop-equal web app for viewing and managing a family tree. Initially one family (ours), shared with siblings and cousins so we can build up a largely populated tree together. Designed so additional, unrelated families can be hosted later.

## 2. Decisions (agreed 2026-10-15, auth updated 2026-10-18)

| Topic | Decision |
|-------|----------|
| Repo | `ZarleyLtd/FamilyTree`, public, GitHub Pages from `main` root |
| Architecture | Static HTML/CSS/vanilla JS + Supabase Edge Function `familytree-api`, same shape as BGS / Scrabble / theConfessional |
| Database | Shared **Apps** Supabase project, new schema `familytree`. Migrate to a dedicated project later if storage quota demands |
| Media | Supabase Storage bucket `familytree`; browser-side compression to low-res JPEG (≈100 KB) like the BGS gallery |
| Auth | **Share link to view; invite-code accounts to edit** (decided 2026-10-18). Viewing needs only the tree's secret share code. Editing needs a contributor identity: the admin issues a one-time **invite code**, the person registers with it (handle + display name + password of their choice), then signs in on any device with handle + password. Sessions are hashed, expiring tokens. No email dependency. Shape mirrors Supabase Auth so a later switch is painless |
| Privacy | Living persons' details only returned to share-code holders; landing page without code shows nothing personal |
| Data model | Persons, families, events, places, media, notes, change log now; sources/citations/repositories (GEDCOM/Gramps level) designed in but built later |
| Edits | Direct edits by any contributor; every change logged with before/after; admin can revert |
| Visualisation | Hand-rolled SVG charts (pedigree, descendants, hourglass, fan). No chart library |
| Pages | Multi-page (shareable deep links): `index`, `people`, `person`, `tree`, `gallery`, `admin` |
| Seed data | None – start from scratch in the app |

### Access model in detail

```
Viewing     tree.share_code          → ?t=K7PX2Q stored in localStorage. Anyone with the link sees the tree, including living persons.
Editing     contributor identity     → one row per person (not per device). Same handle + password on phone, laptop, or a new session.
Admin       tree.admin_code_hash     → unlocks admin page: invites, reset codes, disable, revert, purge.
```

**Viewing.** Devices without a share code get a landing page only ("Ask a family member for the link"). Rotating the share code revokes view access (as with sharing a doc link).

**Becoming a contributor (admin-gated, no email).**

1. Admin issues a one-time **invite code** (optionally labelled, e.g. "for Siobhán") from the admin page. The code is shown once so it can be sent in a message.
2. The person **Registers**: invite code + unique handle + display name + password of their choice. The invite is marked claimed and cannot be reused. A `contributors` row is the identity.
3. Later, on any device or session, they **Connect** with handle + password. The server issues a random **session token** (hash stored in `sessions`, ~90-day sliding expiry). Mutations carry that token; `change_log` records `actor_id` + `actor_name`.
4. **Forgot password:** they cannot reuse the original invite. They ask the admin, who issues a one-time **reset code** (expires after use or 24 h). They enter handle + reset code + new password. If they have lost both password and a way to reach the admin, the admin disables the old row and issues a fresh invite.

**Why this shape.** `contributors` is the person; `sessions` is "this browser is signed in as that person". Switching later to Supabase Auth is swapping how a session is proven (`auth_user_id` on `contributors`) — the rest of the schema and change log stay the same.

**Security the Edge Function must own** (this is real auth, unlike the sibling apps):

- Passwords hashed with bcrypt or argon2id; never stored or compared in plaintext.
- Invite and reset codes stored as hashes; plaintext shown to the admin once, then discarded.
- Session tokens random, stored hashed, never put in a URL.
- Rate-limit `register`, `connect`, `resetPassword` per IP and per handle.
- Disable a contributor (`disabled_at`) immediately invalidates their sessions.

## 3. Feature review – what mainstream tools offer

Sources: GEDCOM 7 spec, Gramps / Gramps Web data model, webtrees, Ancestry, MyHeritage, FamilySearch.

**Records:** Person · Family/union (partners + children, child relationship type) · Event (birth, baptism, marriage, divorce, census, residence, occupation, emigration, military, death, burial, custom) with fuzzy date + place · Place (hierarchical) · Media (photo/document, linked to any record, captions, face regions) · Note · Source → Citation (with confidence) · Repository.

**Views:** Pedigree (ancestors) · Descendants · Hourglass · Fan chart · Person profile (facts, family, timeline, media, notes) · People list with search/filter/sort · Surname index · Relationship calculator ("2nd cousin once removed", path shown) · Timeline · Gallery · Places map · Statistics (counts, oldest, longest lived, most common names) · Anniversaries / "on this day".

**Collaboration:** multiple contributors, change history, living-person privacy, research to-dos, duplicate detection and merge.

**Interchange:** GEDCOM import/export (7.0 preferred, 5.5.1 accepted).

Everything in bold below is in scope for this project; the rest is listed as future work.

## 4. Phases

Each phase ends with: deployed Edge Function, migration applied, site live on Pages, smoke test done, docs updated.

### Phase 0 – Scaffold (repo, schema, API skeleton)

- [x] Repo, README, `.cursorrules`, docs, `.gitignore`, shared-DB rule
- [x] Sync `brief-message` from `cursor-sites-shared`; add `docs/UI_BRIEF_MESSAGE.md`
- [x] `supabase/config.toml`, migration `familytree_schema` (see DATA_MODEL.md), bucket `familytree`
- [x] Edge Function `familytree-api` skeleton: CORS, `{error,data}` envelope, action router, tree-code guard, `lookupTree`, `register`, `connect`, `whoAmI`, `signOut`
- [x] `assets/css/style.css` design tokens (CSS variables), responsive shell (header, bottom nav on phone, side nav on desktop), `components/header.html`, `footer.html`
- [x] `app-config.js`, `api.js`, `tree-access.js` (share-code capture from `?t=` into localStorage; session token for edits)
- [x] `index.html` landing: with share code → tree home; without → "ask for the link". Header: Connect / Register / signed-in chip
- [x] Create the first tree row (our family) with share + admin codes; seed the first admin contributor (or register via a bootstrap invite)
- [x] GitHub Pages enabled and verified

### Phase 1 – People & relationships (MVP)

- [ ] **Add person**: given names, surname, birth surname, nickname, sex, living flag (auto: no death and born < 110 years ago → living), optional birth/death date+place (written as events), notes
- [ ] **Person profile** `person.html?id=`: name header + photo, facts, parents, siblings, partners & children, events timeline, notes, "edit" when contributor
- [ ] **Relationships**: add parent / add child / add partner / add sibling from a profile via a person picker (search existing or create new inline); child relation type (birth/adopted/step/foster)
- [ ] **Families**: union record with type (married/partners/unknown), marriage event, children ordering
- [ ] **People list** `people.html`: search as you type (name, year), filters (surname, living/deceased, has photo, missing data), sort, alphabet index on desktop, compact cards on phone
- [ ] **Fuzzy dates**: `GenDate.parse("abt 1842" | "bef 1900" | "1850–1855" | "12 Mar 1901" | "Mar 1901" | "1901")` → `{ text, sort, qualifier, end }`, `GenDate.format()`
- [ ] **Change log**: written server-side for every mutation; "Recent changes" on home
- [ ] **Edit & soft-delete** persons/families/events with confirm dialog; undo via admin revert (Phase 4 UI)
- [ ] **Pedigree chart v1** `tree.html?id=&view=pedigree`: 4 generations, SVG, tap a card to recentre, tap name to open profile; vertical layout on phone, horizontal on desktop
- [ ] Mobile/desktop QA pass at 360px and 1280px

### Phase 2 – Photos and artifacts

- [ ] **Upload** from profile / gallery: pick or take photo, compress (`ImageCompress.compressToTarget`, ≈100 KB, long edge 1080), base64 → API → Storage; metadata row in `media`
- [ ] **Kinds**: photo, portrait, document, census, certificate, grave, homestead, map, other; title, caption, fuzzy date, place
- [ ] **Links**: attach one media item to many persons/families/events; set profile photo; optional face region tags on a photo (tap to tag person)
- [ ] **Gallery** `gallery.html`: grid by decade / person / kind, lightbox with swipe (phone) and arrow keys (desktop), "people in this photo"
- [ ] Storage usage shown on admin page (quota awareness for shared project)

### Phase 3 – Views and navigation

- [ ] **Descendants chart**: tidy-tree layout (simple Reingold–Tilford), partners shown beside, generations collapsible
- [ ] **Hourglass**: ancestors above + descendants below a focus person
- [ ] **Fan chart**: SVG arcs, 4–6 generations, 180°/360°, colour by paternal/maternal line, tap to recentre
- [ ] **Pan/zoom** for all charts: pointer events (drag, pinch, wheel), fit-to-screen, recentre
- [ ] **Relationship calculator** (`kinship.js`): BFS to common ancestors → "X is Y's second cousin once removed", path rendered as a mini chart; "How am I related?" uses the signed-in contributor's `self_person_id`
- [ ] **Timeline** on profile (events + photos by date); **surname index**; **statistics** page section; "on this day" on home
- [ ] Share/deep-link buttons (copy link includes `?t=`)

### Phase 4 – Collaboration quality

- [ ] **Admin page** `admin.html` (unlocked with admin code): tree settings, rotate share/admin codes, **issue invite**, **issue password-reset code**, contributors list (rename / disable / make admin), sessions, full change log with diff view and **revert**, purge soft-deleted
- [ ] **Duplicate detection** (same surname + similar given name + birth year ±2) when adding; **merge persons** tool
- [ ] **Research notes / to-dos** per person ("find marriage record"), open-items list
- [ ] **Data quality report**: persons with no parents, no dates, children born before parents, etc.
- [ ] Optional **Realtime** pulse table so open pages refresh when someone else edits (Scrabble pattern)

### Phase 5 – Interchange, sources, multi-family

- [ ] **GEDCOM export** (7.0) including media manifest; **GEDCOM import** (5.5.1 / 7.0) mapping INDI/FAM/EVEN/OBJE/NOTE
- [ ] **Sources & citations**: `sources`, `citations`, `repositories` tables; cite a fact; confidence; citation list on profile
- [ ] **Event participants / roles** (witness, informant, household member for census)
- [ ] **Places**: hierarchy, lat/lng, map view (Leaflet + OSM tiles), "people connected to this place"
- [ ] **Multi-tree UI**: tree switcher by code, per-tree codes/settings already in schema; optional migration to a dedicated Supabase project

## 5. Site map

| Page | Purpose | Key modules |
|------|---------|-------------|
| `index.html` | Landing / tree home: search, recent changes, counts, "on this day", links | `pages/home.js` |
| `people.html` | Searchable, filterable list of persons | `pages/people.js`, `components/person-card.js` |
| `person.html?id=` | Profile: facts, family, timeline, photos, notes, edit | `pages/person.js`, `components/event-editor.js`, `components/person-picker.js` |
| `tree.html?id=&view=` | pedigree · descendants · hourglass · fan | `pages/tree.js`, `components/*-chart.js`, `utils/layout-*.js` |
| `gallery.html` | Media grid + lightbox + upload | `pages/gallery.js`, `components/media-uploader.js`, `components/lightbox.js` |
| `admin.html` | Settings, codes, contributors, change log, tools | `pages/admin.js`, `components/change-log-list.js` |

## 6. UI principles (phone and desktop)

- CSS custom properties for colours/spacing; one `style.css` plus `brief-message.css`.
- Layout breakpoints: `< 700px` phone (bottom tab bar, stacked cards, full-screen sheets for editing), `≥ 700px` tablet/desktop (left nav, two-column profile, modal dialogs).
- Touch targets ≥ 44px; charts support pinch-zoom and drag; desktop gets wheel zoom, hover tooltips, keyboard navigation in lightbox.
- Every list has search-as-you-type; every person reference is a link to the profile.
- Editing is inline on the profile (sheet/modal), never a separate "admin-only" form, so contributors on phones can add people quickly.
- Brief messages for feedback; confirm dialog for destructive actions.

## 7. Technical notes

- **Fuzzy dates:** `date_text` (as typed, e.g. `abt 1842`), `date_sort` (date, e.g. `1842-07-01`), `date_qualifier` (`exact|about|before|after|between|estimated|unknown`), `date_end_sort` for ranges. Sorting and age calculations use `date_sort`; display always uses `date_text`.
- **Living flag:** explicit `is_living` nullable override; otherwise derived server-side (no death event and birth within 110 years, or unknown birth and any child born within 80 years).
- **Privacy filter:** API strips `date_text/place` of birth and other non-public events for living persons when the request carries no valid share code (only relevant for the landing page / future public mode).
- **Change log:** API wraps each mutation: load before-state → apply → load after-state → insert `change_log`. Revert = apply `before` JSON (admin only).
- **Chart layouts** are pure functions (`layoutPedigree(focusId, persons, families, generations)` → nodes/edges with x,y) so they can be tested with `node --test tests/*.test.mjs`.
- **Image pipeline:** `ImageCompress.compressToTarget(file, { targetBytes: 100*1024, maxWidth: 1080 })` → `uploadMedia` → bucket path `trees/<tree_id>/media/<uuid>.jpg`; bucket is public-read so `<img src>` is direct, but paths are unguessable UUIDs. Bucket `file_size_limit` 150 KB, `allowed_mime_types` JPEG/PNG/WebP.
- **Performance:** people list and charts fetch a compact `personSummary` (id, names, sex, living, birth/death year, photo thumb) once per page and cache in memory; profile fetches full detail.

## 8. Risks / open items

- Shared Supabase storage quota (free tier 1 GB) – mitigated by ≈100 KB images and admin usage display; migrate to dedicated project if needed.
- Link-based **view** access is "anyone with the link"; acceptable per decision, the share code can be rotated. Editing is a person identity (handle + password), not a shared edit code.
- Custom password auth is security-sensitive code we own (hashing, sessions, rate limits). Keep it small and isolated in the Edge Function so a later switch to Supabase Auth is a swap of `connect`/`register`, not of the rest of the API.
- Hand-rolled chart layouts take longer than a library; mitigated by pure, tested layout functions and starting with pedigree (simplest).
- Fuzzy-date parsing edge cases (Irish records: "circa", "Q2 1864" civil registration quarters) – parser must accept quarter dates.
