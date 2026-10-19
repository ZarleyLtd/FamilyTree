# FamilyTree API (`familytree-api`)

Supabase Edge Function, deployed with `--no-verify-jwt`. All responses are JSON `{ error: string | null, data: any }` (Scrabble/theConfessional convention). HTTP 200 on success, 400/403/404 with `error` set otherwise.

## Transport

- **GET** `?action=…&treeCode=…&…` with no custom headers.
- **POST** body is a JSON string with `Content-Type: text/plain;charset=UTF-8`: `{ "action": "…", "treeCode": "…", "sessionToken": "…", …params }`.
- CORS: `Access-Control-Allow-Origin: *`.

## Access parameters

| Param | Required for | Notes |
|-------|--------------|-------|
| `treeCode` | all actions except `lookupTree` | share code; invalid → 403 |
| `sessionToken` | all mutations, `whoAmI`, `signOut` | issued by `register` / `connect`; unknown, expired, revoked, or contributor disabled → 403 |
| `adminCode` | admin actions that are not already gated by an admin-role session | tree admin unlock code. Prefer an admin-role session after `unlockAdmin`. |

Living-person detail is only returned when `treeCode` is valid (which is every normal call). A future public mode would omit the code and receive redacted data.

## Actions – Phase 0/1

| Action | Method | Purpose |
|--------|--------|---------|
| `status` | GET | (no tree code) → `{ hasTrees: boolean }` so the landing page can offer first-tree setup |
| `bootstrapTree` | POST | `{ name? }` → `{ tree, shareCode, adminCode, inviteCode, expiresAt }`. Only when there are zero trees. Codes shown once. |
| `lookupTree` | GET | `{ treeCode }` → `{ id, name, personCount, settings.homePersonId }` or 404 |
| `register` | POST | `{ treeCode, inviteCode, handle, displayName, password }` → `{ sessionToken, contributor }`. Invite must be unused, unexpired, `purpose=register`. Handle unique per tree (case-insensitive). The first contributor on a tree is `admin`. Rate-limited. |
| `connect` | POST | `{ treeCode, handle, password }` → `{ sessionToken, contributor }`. Rate-limited. Disabled contributors → 403. |
| `resetPassword` | POST | `{ treeCode, handle, resetCode, newPassword }` → `{ ok: true }`. Invite must be unused, unexpired, `purpose=reset`, matching `contributor_id`. Revokes existing sessions. Rate-limited. |
| `signOut` | POST | `{ sessionToken }` → `{ ok: true }` (revokes that session) |
| `whoAmI` | POST | `{ treeCode, sessionToken }` → `{ id, handle, displayName, role, selfPersonId }`. POST so the session token is not placed in a URL. |
| `setSelfPerson` | POST | `{ personId }` |
| `unlockAdmin` | POST | `{ treeCode, sessionToken, adminCode }` → `{ ok: true }` if the code matches; caller should already be a signed-in contributor. Admin-role contributors skip this. |
| `listPersons` | GET | `{ q?, surname?, living?, hasPhoto?, limit?, offset? }` → `{ persons: PersonSummary[] }` |
| `getPerson` | GET | `{ id }` → `{ person, events, parents: Family[], families: Family[] (with children), media, notes }` |
| `createPerson` | POST | `{ person: {...}, birth?: EventInput, death?: EventInput }` → `{ person }` |
| `updatePerson` | POST | `{ id, patch }` |
| `deletePerson` | POST | `{ id }` (soft) |
| `createFamily` | POST | `{ partner1Id?, partner2Id?, relationshipType?, marriage?: EventInput }` → `{ family }` |
| `updateFamily` | POST | `{ id, patch }` |
| `addChild` | POST | `{ familyId, childId, relationType? }` |
| `removeChild` | POST | `{ familyId, childId }` |
| `reorderChildren` | POST | `{ familyId, childIds[] }` |
| `addParentToPerson` | POST | `{ childId, parent: { existingId } \| { new: PersonInput }, sex? }` → creates/extends parent family |
| `createEvent` | POST | `{ personId \| familyId, type, dateText?, placeText?, description? }` |
| `updateEvent` / `deleteEvent` | POST | |
| `createNote` | POST | `{ targetType, targetId, kind?, body }` |
| `getPedigree` | GET | `{ focusId, generations }` → `{ persons: PersonSummary[], families: FamilyLink[] }` |
| `recentChanges` | GET | `{ limit? }` → `{ changes: ChangeLogRow[] }` |
| `stats` | GET | → `{ persons, living, families, media, surnames, withPhoto, missingBirth, longestLived, oldestLiving, commonNames }` |

## Actions – Phase 2

| Action | Method | Purpose |
|--------|--------|---------|
| `uploadMedia` | POST | `{ base64, mimeType, kind, title?, caption?, dateText?, placeText?, width?, height?, links?: [{targetType,targetId,isPrimary,region?}] }` → `{ media }`; JPEG/PNG/WebP, max 150 KB. Stored at `trees/<tree_id>/media/<uuid>.jpg` |
| `updateMedia` | POST | `{ id, patch }` title, caption, kind, dateText, placeText |
| `deleteMedia` | POST | `{ id }` (soft; file removed on admin purge) |
| `linkMedia` / `unlinkMedia` | POST | `{ mediaId, targetType, targetId, isPrimary?, region? }` — `region` is `{x,y,w,h}` fractions, or `null` to clear a face box. `isPrimary` on a person sets `profile_media_id` |
| `listMedia` | GET | `{ personId?, kind?, decade?, q?, limit?, offset? }` → `{ media, total }` |
| `storageUsage` | POST | admin session → `{ count, bytes, quotaBytes, note }` |

## Actions – Phase 3

| Action | Method | Purpose |
|--------|--------|---------|
| `getDescendants` | GET | `{ focusId, generations }` → `{ persons, families }` for that many generations down, including partners |
| `getHourglass` | GET | `{ focusId, up, down }` → ancestors and descendants in one bundle |
| `relationship` | GET | `{ fromId, toId }` → `{ term, phrase, path: PersonSummary[], commonAncestors, description }`. `to` is `from`'s `term` ("Nuala is James's niece") |
| `timeline` | GET | `{ personId }` → `{ items }` events (including marriages) and linked media, dated ones first |
| `onThisDay` | GET | `{ month, day }` → exact-date events, marriages and photos for that calendar day. Pass the viewer's local month and day |

## Actions – Phase 5 (admin)

| Action | Method | Purpose |
|--------|--------|---------|
| `getTreeSettings` / `updateTreeSettings` | | admin session or `adminCode` |
| `rotateCodes` | POST | `{ which: 'share' \| 'admin', newCode? }` |
| `issueInvite` | POST | `{ purpose: 'register' \| 'reset', label?, contributorId? }` → `{ code, expiresAt }` (plaintext code once) |
| `listInvites` | GET | pending (unused, unexpired) invites |
| `revokeInvite` | POST | `{ inviteId }` |
| `listContributors` / `updateContributor` | | rename display name, change role, disable (revokes sessions) |
| `listSessions` | GET | `{ contributorId? }` |
| `revokeSessions` | POST | `{ contributorId }` sign out everywhere |
| `changeLog` | GET | `{ adminCode, limit, offset, targetId? }` |
| `revertChange` | POST | `{ adminCode, changeId }` |
| `findDuplicates` | GET | |
| `mergePersons` | POST | `{ keepId, mergeId }` |
| `purgeDeleted` | POST | `{ adminCode }` |
| `storageUsage` | POST | admin session. Shipped in Phase 2; `{ count, bytes, quotaBytes }` |

## Actions – Phase 5

`exportGedcom`, `importGedcom`, `createSource`, `addCitation`, `listPlaces`, `upsertPlace`.

## Shapes

```ts
PersonSummary {
  id, givenNames, surname, birthSurname, nickname, sex: 'M'|'F'|'U',
  living: boolean, birthYear?: number, deathYear?: number,
  birthDateText?: string, deathDateText?: string, thumbUrl?: string
}
EventInput { type, dateText?, placeText?, description? }
Family { id, partner1: PersonSummary|null, partner2: PersonSummary|null, relationshipType, status, children: (PersonSummary & { relationType })[] , marriage?: Event }
ChangeLogRow { id, actorId, actorName, action, targetType, targetId, summary, createdAt }
Contributor { id, handle, displayName, role, selfPersonId }
```
