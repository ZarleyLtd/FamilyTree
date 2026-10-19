# FamilyTree – data model (schema `familytree`)

All tables live in Postgres schema `familytree` on the shared Apps project. RLS is enabled on every table with **no** anon/authenticated policies; only the service role (Edge Function) reads or writes. Every table carries `tree_id` so multiple unrelated families can share the schema.

Conventions: `id uuid primary key default gen_random_uuid()`, `created_at/updated_at timestamptz`, `created_by/updated_by text` (contributor display name at the time), soft delete via `deleted_at timestamptz` where noted.

## Core (Phase 0–1)

### `trees`
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| name | text | e.g. "Power family" |
| slug | text unique | url-safe |
| share_code | text unique | 6–8 chars, read access for anyone with the link |
| admin_code_hash | text | bcrypt/argon2 of the admin unlock code |
| settings | jsonb | `{ homePersonId, livingAgeLimit: 110, defaultChartGenerations: 4 }` |
| created_at, updated_at | timestamptz | |

### `invites`
One-time codes the admin issues so a person can register (or reset a password). Plaintext is shown once and never stored.
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| purpose | text | `register` \| `reset` |
| code_hash | text unique | hash of the code shown to the admin |
| label | text null | admin note, e.g. "for Siobhán" – not shown to the registrant |
| contributor_id | uuid → contributors null | required for `reset`; null until a `register` invite is claimed |
| created_by | uuid → contributors | the admin who issued it |
| expires_at | timestamptz | register: e.g. 30 days; reset: 24 hours |
| used_at | timestamptz null | set on successful register/reset; code cannot be reused |
| created_at | timestamptz | |

Index `(tree_id, used_at)` for the admin "pending invites" list.

### `contributors`
One row per **person** who can edit, not per device. Same handle + password on phone, laptop, or a new session.
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| handle | text | unique per tree; used to Connect. Stored lowercased. |
| display_name | text | shown in the change log; may differ from handle |
| password_hash | text | bcrypt or argon2id |
| role | text | `contributor` \| `admin` |
| self_person_id | uuid → persons null | "this is me" for the relationship calculator |
| invite_id | uuid → invites null | the register-invite that created this row |
| disabled_at | timestamptz null | revoke; also deletes/invalidates sessions |
| last_seen_at, created_at, updated_at | timestamptz | |
| auth_user_id | uuid null | reserved: if we later switch to Supabase Auth, this is the mapping |

Unique `(tree_id, handle)`.

### `sessions`
Proof that a browser is signed in as a contributor. Mutations send the session token; the server hashes it and looks up this row.
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| contributor_id | uuid → contributors | |
| token_hash | text unique | hash of the random token issued at Connect / Register |
| created_at | timestamptz | |
| expires_at | timestamptz | default now() + 90 days; sliding renewal on use |
| last_seen_at | timestamptz | |
| revoked_at | timestamptz null | sign-out, password reset, or contributor disabled |

On password reset, disable, or admin "sign out everywhere": set `revoked_at` on all of that contributor's sessions.

### `persons`
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| given_names | text | |
| surname | text | current / last known |
| birth_surname | text null | maiden name |
| nickname | text null | |
| suffix | text null | Jr, III |
| sex | text | `M` \| `F` \| `U` |
| is_living | boolean null | explicit override; null = derive |
| privacy | text | `normal` \| `private` (extra-restricted even for share-code holders; future) |
| profile_media_id | uuid → media null | |
| bio | text null | free text |
| created_by, updated_by, created_at, updated_at, deleted_at | | soft delete |

Indexes: `(tree_id, surname, given_names)`, trigram index on `surname || ' ' || given_names` for search (`pg_trgm`).

Cached summary columns maintained by the API after any event change (avoids joins for lists/charts): `birth_year int`, `death_year int`, `birth_place_short text`, `death_place_short text`, `birth_date_text`, `death_date_text`.

### `families`
A union of up to two partners and their children.
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| partner1_id | uuid → persons null | |
| partner2_id | uuid → persons null | |
| relationship_type | text | `married` \| `partners` \| `unknown` |
| status | text null | `together` \| `divorced` \| `separated` \| `widowed` |
| notes | text null | |
| created_by, updated_by, created_at, updated_at, deleted_at | | |

Index `(tree_id, partner1_id)`, `(tree_id, partner2_id)`. Unique couple index on `(tree_id, LEAST(partner1_id, partner2_id), GREATEST(partner1_id, partner2_id))` where both partners are set and the row is not deleted — one family per unordered pair. A person may appear in several families (remarriage to a different person). Single-parent families (`partner2_id` null) are not unique.

### `family_children`
| column | type | notes |
|--------|------|-------|
| family_id | uuid → families | |
| child_id | uuid → persons | |
| relation_type | text | `birth` \| `adopted` \| `step` \| `foster` \| `unknown` |
| seq | int | display order (usually by birth) |
| primary key (family_id, child_id) | | |

Index `(child_id)` – to find a person's parents.

### `events`
A fact with a fuzzy date and place, belonging to a person **or** a family.
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| person_id | uuid → persons null | exactly one of person_id / family_id |
| family_id | uuid → families null | |
| type | text | `birth` `baptism` `marriage` `divorce` `death` `burial` `census` `residence` `occupation` `education` `emigration` `immigration` `military` `retirement` `custom` |
| title | text null | for `custom` / occupation label |
| date_text | text null | as typed, e.g. `abt 1842`, `Q2 1864` |
| date_sort | date null | approximate for ordering |
| date_end_sort | date null | for `between` ranges |
| date_qualifier | text | `exact` `about` `before` `after` `between` `estimated` `unknown` |
| place_id | uuid → places null | |
| place_text | text null | free text until a place record exists |
| description | text null | |
| is_private | boolean default false | hidden from non-share-code viewers (all living-person events are treated private regardless) |
| created_by, updated_by, created_at, updated_at, deleted_at | | |

Index `(person_id, date_sort)`, `(family_id, date_sort)`, `(tree_id, type)`.

### `places`
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| name | text | "Crossguns, Phibsborough" |
| parent_place_id | uuid → places null | hierarchy (townland → parish → county → country) |
| place_type | text null | townland, town, parish, county, country, address |
| lat, lng | double precision null | |
| notes | text null | |
| created_at, updated_at | | |

### `media` (Phase 2)
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| storage_path | text | `trees/<tree_id>/media/<uuid>.jpg` in bucket `familytree` |
| public_url | text | |
| mime_type | text | |
| byte_size | int | |
| width, height | int null | |
| kind | text | `photo` `portrait` `document` `census` `certificate` `grave` `homestead` `map` `other` |
| title | text null | |
| caption | text null | |
| date_text, date_sort, date_end_sort, date_qualifier | | fuzzy date of the photo/document; `date_end_sort` for ranges |
| place_id | uuid → places null | |
| place_text | text null | free text until a place record exists |
| uploaded_by, created_at, updated_at, deleted_at | | |

### `media_links`
Polymorphic attachment of media to records.
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| media_id | uuid → media | |
| target_type | text | `person` `family` `event` `place` |
| target_id | uuid | |
| is_primary | boolean | profile photo for a person |
| region | jsonb null | `{ x, y, w, h }` as fractions – face tag |
| seq | int | |

Index `(target_type, target_id)`, `(media_id)`.

### `notes`
| column | type | notes |
|--------|------|-------|
| id | uuid | |
| tree_id | uuid → trees | |
| target_type | text | `person` `family` `event` `media` `place` `tree` |
| target_id | uuid | |
| kind | text | `note` \| `research` \| `todo` |
| body | text | |
| done_at | timestamptz null | for todos |
| created_by, updated_by, created_at, updated_at, deleted_at | | |

### `change_log`
Written by the API for every mutation.
| column | type | notes |
|--------|------|-------|
| id | bigserial | |
| tree_id | uuid → trees | |
| actor_id | uuid → contributors null | identity; survives a later display-name change |
| actor_name | text | display name copied at the time of the edit |
| action | text | `create` `update` `delete` `restore` `merge` `upload` `revert` |
| target_type | text | table name |
| target_id | uuid | |
| summary | text | human sentence: "Added John Power (b. abt 1842)" |
| before | jsonb null | |
| after | jsonb null | |
| reverted_by | bigint null → change_log | |
| created_at | timestamptz | |

Index `(tree_id, created_at desc)`, `(target_type, target_id)`.

## Deferred (Phase 5) – designed in, not created yet

- `sources` (tree_id, title, author, publication, repository_id, notes)
- `citations` (source_id, target_type, target_id, page, date_text, confidence 0–3, text)
- `repositories` (tree_id, name, address, url)
- `event_participants` (event_id, person_id, role: witness/informant/household/godparent)
- `tree_pulse` (tree_id, version, updated_at) for Realtime refresh

## Derived data

- **Living**: `coalesce(is_living, derived)` where derived = no death/burial event AND (birth_year is null OR birth_year > extract(year from now()) - settings.livingAgeLimit).
- **Person summary** (used by lists and charts): id, given_names, surname, birth_surname, sex, living, birth_year, death_year, birth_date_text, death_date_text, profile thumb URL, parent family id(s), spouse family id(s). Served by `listPersons` and cached client-side per page load.

## Storage

Bucket `familytree`: public read (unguessable UUID paths), `file_size_limit` 150 KB, `allowed_mime_types` `image/jpeg, image/png, image/webp`. Writes only via Edge Function (service role). Deleting a `media` row (admin purge) also removes the object.

## Example queries the API needs

- Parents of X: `family_children fc join families f on f.id = fc.family_id where fc.child_id = X`
- Children of X: `families where partner1_id = X or partner2_id = X` → `family_children`
- Pedigree N generations: recursive CTE up the parent links from focus, depth ≤ N
- Descendants N generations: recursive CTE down via families/family_children
- Relationship X↔Y: ancestor sets with depth for both; intersect; minimal (dx, dy) → kinship term
