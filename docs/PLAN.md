# FamilyTree – development plan

_Last updated: 2026-10-15_

## 1. Goal

A phone-first, desktop-equal web app for viewing and managing a family tree. Initially one family (ours), shared with siblings and cousins so we can build up a largely populated tree together. Designed so additional, unrelated families can be hosted later.

## 2. Decisions (agreed 2026-10-15)

| Topic | Decision |
|-------|----------|
| Repo | `ZarleyLtd/FamilyTree`, public, GitHub Pages from `main` root |
| Architecture | Static HTML/CSS/vanilla JS + Supabase Edge Function `familytree-api`, same shape as BGS / Scrabble / theConfessional |
| Database | Shared **Apps** Supabase project, new schema `familytree`. Migrate to a dedicated project later if storage quota demands |
| Media | Supabase Storage bucket `familytree`; browser-side compression to low-res JPEG (≈100 KB) like the BGS gallery |
| Auth | **No accounts.** Shared-document model: secret share code to view, contributor code to edit, device token + display name for attribution. Keep a clean path to Supabase Auth later |
| Privacy | Living persons' details only returned to share-code holders; landing page without code shows nothing personal |
| Data model | Persons, families, events, places, media, notes, change log now; sources/citations/repositories (GEDCOM/Gramps level) designed in but built later |
| Edits | Direct edits by any contributor; every change logged with before/after; admin can revert |
| Visualisation | Hand-rolled SVG charts (pedigree, descendants, hourglass, fan). No chart library |
| Pages | Multi-page (shareable deep links): `index`, `people`, `person`, `tree`, `gallery`, `admin` |
| Seed data | None – start from scratch in the app |

### Access model in detail

```
Tree ──┬── share_code        (e.g. K7PX2Q)   → ?t=K7PX2Q, stored in localStorage → read access incl. living persons
       └── contributor_code  (admin-chosen)  → entered once → API returns contributor token → write access, attributed edits
Admin  ─── admin_code        (admin-chosen)  → tree settings, codes, change-log revert, purge
```

- Devices without a share code get a landing page only ("Ask a family member for the link").
- Contributor registration: `registerContributor(treeCode, contributorCode, displayName)` → `{ contributorToken }` (hash stored). Every mutation carries the token; `change_log` records `actor_name` and `actor_token_hash`.
- Rotating codes revokes access (as with sharing a doc link).
- Future accounts: add `auth_user_id` to `contributors`; nothing else changes.

## 3. Feature review – what mainstream tools offer

Sources: GEDCOM 7 spec, Gramps / Gramps Web data model, webtrees, Ancestry, MyHeritage, FamilySearch.

**Records:** Person · Family/union (partners + children, child relationship type) · Event (birth, baptism, marriage, divorce, census, residence, occupation, emigration, military, death, burial, custom) with fuzzy date + place · Place (hierarchical) · Media (photo/document, linked to any record, captions, face regions) · Note · Source → Citation (with confidence) · Repository.

**Views:** Pedigree (ancestors) · Descendants · Hourglass · Fan chart · Person profile (facts, family, timeline, media, notes) · People list with search/filter/sort · Surname index · Relationship calculator ("2nd cousin once removed", path shown) · Timeline · Gallery · Places map · Statistics (counts, oldest, longest lived, most common names) · Anniversaries / "on this day".

**Collaboration:** multiple contributors, change history, living-person privacy, research to-dos, duplicate detection and merge.

**Interchange:** GEDCOM import/export (7.0 preferred, 5.5.1 accepted).

Everything in bold below is in scope for this project; the rest is listed as future work.

## 4. Phases

Each phase ends with: deployed Edge Function, migration applied, site live on Pages, smoke test done, docs updated.

### Phase 0 – Scaffold (repo, schema, API skeleton) ✅ repo created

- [x] Repo, README, `.cursorrules`, docs, `.gitignore`, shared-DB rule
- [ ] Sync `brief-message` from `cursor-sites-shared`; add `docs/UI_BRIEF_MESSAGE.md`
- [ ] `supabase/config.toml`, migration `familytree_schema` (see DATA_MODEL.md), bucket `familytree`
- [ ] Edge Function `familytree-api` skeleton: CORS, `{error,data}` envelope, action router, tree-code guard, `getTree`, `registerContributor`, `whoAmI`
- [ ] `assets/css/style.css` design tokens (CSS variables), responsive shell (header, bottom nav on phone, side nav on desktop), `components/header.html`, `footer.html`
- [ ] `app-config.js`, `api.js`, `tree-access.js` (code capture from `?t=`, localStorage, contributor token)
- [ ] `index.html` landing: with code → tree home (name, counts, recent changes, search box, quick links); without code → "ask for the link"
- [ ] Create the first tree row (our family) with share/contributor/admin codes
- [ ] GitHub Pages enabled and verified

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
- [ ] **Relationship calculator** (`kinship.js`): BFS to common ancestors → "X is Y's second cousin once removed", path rendered as a mini chart; "How am I related?" uses the device's "this is me" person
- [ ] **Timeline** on profile (events + photos by date); **surname index**; **statistics** page section; "on this day" on home
- [ ] Share/deep-link buttons (copy link includes `?t=`)

### Phase 4 – Collaboration quality

- [ ] **Admin page** `admin.html`: tree settings, rotate codes, contributors list (rename/disable), full change log with diff view and **revert**, purge soft-deleted
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
- Link-based access is "anyone with the link"; acceptable per decision, codes can be rotated.
- Hand-rolled chart layouts take longer than a library; mitigated by pure, tested layout functions and starting with pedigree (simplest).
- Fuzzy-date parsing edge cases (Irish records: "circa", "Q2 1864" civil registration quarters) – parser must accept quarter dates.
