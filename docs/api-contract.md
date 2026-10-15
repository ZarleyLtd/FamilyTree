# FamilyTree API (`familytree-api`)

Supabase Edge Function, deployed with `--no-verify-jwt`. All responses are JSON `{ error: string | null, data: any }` (Scrabble/theConfessional convention). HTTP 200 on success, 400/403/404 with `error` set otherwise.

## Transport

- **GET** `?action=…&treeCode=…&…` with no custom headers.
- **POST** body is a JSON string with `Content-Type: text/plain;charset=UTF-8`: `{ "action": "…", "treeCode": "…", "contributorToken": "…", …params }`.
- CORS: `Access-Control-Allow-Origin: *`.

## Access parameters

| Param | Required for | Notes |
|-------|--------------|-------|
| `treeCode` | all actions except `lookupTree` | share code; invalid → 403 |
| `contributorToken` | all mutations | issued by `registerContributor`; disabled/unknown → 403 |
| `adminCode` | admin actions | tree admin code |

Living-person detail is only returned when `treeCode` is valid (which is every normal call). A future public mode would omit the code and receive redacted data.

## Actions – Phase 0/1

| Action | Method | Purpose |
|--------|--------|---------|
| `lookupTree` | GET | `{ treeCode }` → `{ id, name, personCount, settings.homePersonId }` or 404 |
| `registerContributor` | POST | `{ treeCode, contributorCode, displayName }` → `{ contributorToken, role }` |
| `whoAmI` | GET | `{ treeCode, contributorToken }` → `{ displayName, role, selfPersonId }` |
| `setSelfPerson` | POST | `{ personId }` |
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
| `getPedigree` | GET | `{ focusId, generations }` → `{ persons: PersonSummary[], families: FamilyLink[] }` |
| `recentChanges` | GET | `{ limit? }` → `{ changes: ChangeLogRow[] }` |
| `stats` | GET | → `{ persons, living, families, media, surnames: [{surname,count}] }` |

## Actions – Phase 2

| Action | Method | Purpose |
|--------|--------|---------|
| `uploadMedia` | POST | `{ base64, mimeType, kind, title?, caption?, dateText?, placeText?, links?: [{targetType,targetId,isPrimary}] }` → `{ media }`; JPEG/PNG/WebP, max 150 KB |
| `updateMedia` | POST | `{ id, patch }` |
| `deleteMedia` | POST | `{ id }` (soft) |
| `linkMedia` / `unlinkMedia` | POST | `{ mediaId, targetType, targetId, isPrimary?, region? }` |
| `listMedia` | GET | `{ personId?, kind?, decade?, limit?, offset? }` |

## Actions – Phase 3

| Action | Method | Purpose |
|--------|--------|---------|
| `getDescendants` | GET | `{ focusId, generations }` |
| `getHourglass` | GET | `{ focusId, up, down }` |
| `relationship` | GET | `{ fromId, toId }` → `{ term, path: PersonSummary[], commonAncestors }` |
| `timeline` | GET | `{ personId }` → events + media in date order |
| `onThisDay` | GET | `{ month, day }` |

## Actions – Phase 4 (admin)

| Action | Method | Purpose |
|--------|--------|---------|
| `getTreeSettings` / `updateTreeSettings` | | `{ adminCode }` |
| `rotateCodes` | POST | `{ adminCode, which: 'share' \| 'contributor' \| 'admin', newCode? }` |
| `listContributors` / `updateContributor` | | rename, disable |
| `changeLog` | GET | `{ adminCode, limit, offset, targetId? }` |
| `revertChange` | POST | `{ adminCode, changeId }` |
| `findDuplicates` | GET | |
| `mergePersons` | POST | `{ keepId, mergeId }` |
| `purgeDeleted` | POST | `{ adminCode }` |
| `storageUsage` | GET | `{ adminCode }` |

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
ChangeLogRow { id, actorName, action, targetType, targetId, summary, createdAt }
```
