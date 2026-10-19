/**
 * Person / family / event helpers for familytree-api.
 */
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { phrase, relate, type KinGraph, type KinPerson } from "./kinship.ts";

export function statusErr(message: string, status: number) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad(n: number) {
  return n < 10 ? "0" + n : String(n);
}

function yearFromSort(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getUTCFullYear();
  const m = String(v).match(/(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1000 && y <= 9999 ? y : null;
}

function isoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}
function iso(y: number, m: number, d: number) {
  if (!y || y < 1000 || y > 9999) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
function monthNum(name: string) {
  return MONTHS[String(name || "").toLowerCase().replace(/\./g, "")] || 0;
}

export type ParsedDate = {
  text: string;
  sort: string | null;
  qualifier: string;
  end: string | null;
};

export function parseGenDate(raw: unknown): ParsedDate | null {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;
  const original = text;
  let s = text.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  let qualifier = "exact";
  let end: string | null = null;
  let sort: string | null = null;

  if (/^(unknown|unk|\?)$/.test(s)) {
    return { text: original, sort: null, qualifier: "unknown", end: null };
  }
  const qtr = s.match(/^q([1-4])\s+(\d{4})$/);
  if (qtr) {
    const q = Number(qtr[1]);
    const qy = Number(qtr[2]);
    const qm = [2, 5, 8, 11][q - 1];
    return { text: original, sort: iso(qy, qm, 15), qualifier: "about", end: null };
  }
  if (/^(circa|ca|c|abt|about|approx|approximately|est|estimated)\b/.test(s)) {
    qualifier = /^(est|estimated)\b/.test(s) ? "estimated" : "about";
    s = s.replace(/^(circa|ca|c|abt|about|approx|approximately|est|estimated)\s+/, "");
  } else if (/^(bef|before|by)\b/.test(s)) {
    qualifier = "before";
    s = s.replace(/^(bef|before|by)\s+/, "");
  } else if (/^(aft|after|from)\b/.test(s)) {
    qualifier = "after";
    s = s.replace(/^(aft|after|from)\s+/, "");
  } else if (/^(bet|between)\b/.test(s)) {
    qualifier = "between";
    s = s.replace(/^(bet|between)\s+/, "").replace(/\s+and\s+/g, "-");
  }

  const range = s.match(/^(\d{4})\s*[\-–—to]+\s*(\d{4})$/);
  if (range) {
    return {
      text: original,
      sort: iso(Number(range[1]), 1, 1),
      qualifier: "between",
      end: iso(Number(range[2]), 12, 31),
    };
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return { text: original, sort: iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3])), qualifier, end };
  }
  const dmyNum = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyNum) {
    let yr = Number(dmyNum[3]);
    if (yr < 100) yr = yr >= 30 ? 1900 + yr : 2000 + yr;
    return { text: original, sort: iso(yr, Number(dmyNum[2]), Number(dmyNum[1])), qualifier, end };
  }
  const dMonY = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(of\s+)?([a-z]+)\s+(\d{4})$/);
  if (dMonY) {
    return { text: original, sort: iso(Number(dMonY[4]), monthNum(dMonY[3]), Number(dMonY[1])), qualifier, end };
  }
  const monDY = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/);
  if (monDY && monthNum(monDY[1])) {
    return { text: original, sort: iso(Number(monDY[3]), monthNum(monDY[1]), Number(monDY[2])), qualifier, end };
  }
  const monY = s.match(/^([a-z]+)\s+(\d{4})$/);
  if (monY && monthNum(monY[1])) {
    return {
      text: original,
      sort: iso(Number(monY[2]), monthNum(monY[1]), 1),
      qualifier: qualifier === "exact" ? "about" : qualifier,
      end,
    };
  }
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) {
    const y = Number(yearOnly[1]);
    if (qualifier === "exact") {
      sort = iso(y, 7, 1);
      qualifier = "about";
    } else if (qualifier === "before") sort = iso(y, 1, 1);
    else if (qualifier === "after") sort = iso(y, 12, 31);
    else sort = iso(y, 7, 1);
    return { text: original, sort, qualifier, end };
  }
  const anyYear = s.match(/(\d{4})/);
  if (anyYear) {
    return { text: original, sort: iso(Number(anyYear[1]), 7, 1), qualifier: "estimated", end: null };
  }
  return { text: original, sort: null, qualifier: "unknown", end: null };
}

function livingAgeLimit(tree: Record<string, unknown>) {
  let settings: Record<string, unknown> = {};
  const raw = tree.settings;
  if (raw && typeof raw === "object") settings = raw as Record<string, unknown>;
  else if (typeof raw === "string") {
    try {
      settings = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }
  const n = Number(settings.livingAgeLimit);
  return n > 0 ? n : 110;
}

export function isLivingRow(row: Record<string, unknown>, limit: number) {
  if (row.is_living === true) return true;
  if (row.is_living === false) return false;
  if (row.death_year != null) return false;
  if (row.birth_year == null) return true;
  return Number(row.birth_year) > new Date().getFullYear() - limit;
}

export function personSummary(row: Record<string, unknown>, limit: number) {
  return {
    id: row.id,
    givenNames: row.given_names || "",
    surname: row.surname || "",
    birthSurname: row.birth_surname || null,
    nickname: row.nickname || null,
    suffix: row.suffix || null,
    sex: row.sex || "U",
    living: isLivingRow(row, limit),
    birthYear: row.birth_year == null ? null : Number(row.birth_year),
    deathYear: row.death_year == null ? null : Number(row.death_year),
    birthDateText: row.birth_date_text || null,
    deathDateText: row.death_date_text || null,
    birthPlaceShort: row.birth_place_short || null,
    deathPlaceShort: row.death_place_short || null,
    thumbUrl: row.thumb_url ? String(row.thumb_url) : null,
  };
}

function displayName(row: Record<string, unknown>) {
  return [row.given_names, row.surname].filter(Boolean).join(" ").trim() || "Unknown";
}

function shortPlace(text: unknown) {
  const s = String(text || "").trim();
  if (!s) return null;
  return s.split(",")[0].trim().slice(0, 80);
}

function json(v: unknown) {
  return JSON.stringify(v ?? null);
}

export async function writeLog(
  pg: Client,
  opts: {
    treeId: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    summary: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await pg.queryArray`
    INSERT INTO familytree.change_log
      (tree_id, actor_id, actor_name, action, target_type, target_id, summary, before, after)
    VALUES (
      ${opts.treeId}::uuid,
      ${opts.actorId}::uuid,
      ${opts.actorName},
      ${opts.action},
      ${opts.targetType},
      ${opts.targetId}::uuid,
      ${opts.summary},
      ${json(opts.before ?? null)}::jsonb,
      ${json(opts.after ?? null)}::jsonb
    )
  `;
}

export async function loadPerson(pg: Client, treeId: string, id: string) {
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT p.*, m.public_url AS thumb_url
    FROM familytree.persons p
    LEFT JOIN familytree.media m
      ON m.id = p.profile_media_id AND m.deleted_at IS NULL
    WHERE p.id = ${id}::uuid AND p.tree_id = ${treeId}::uuid AND p.deleted_at IS NULL
    LIMIT 1
  `;
  return r.rows[0] || null;
}

export async function refreshPersonCache(pg: Client, personId: string) {
  const ev = await pg.queryObject<Record<string, unknown>>`
    SELECT type, date_text, date_sort, place_text
    FROM familytree.events
    WHERE person_id = ${personId}::uuid AND deleted_at IS NULL
      AND type IN ('birth', 'death', 'burial')
    ORDER BY date_sort NULLS LAST, created_at
  `;
  let birth: Record<string, unknown> | null = null;
  let death: Record<string, unknown> | null = null;
  for (const e of ev.rows) {
    if (e.type === "birth" && !birth) birth = e;
    if ((e.type === "death" || e.type === "burial") && !death) death = e;
  }
  const by = yearFromSort(birth && birth.date_sort);
  const dy = yearFromSort(death && death.date_sort);
  await pg.queryArray`
    UPDATE familytree.persons SET
      birth_year = ${by},
      death_year = ${dy},
      birth_date_text = ${birth ? String(birth.date_text || "") || null : null},
      death_date_text = ${death ? String(death.date_text || "") || null : null},
      birth_place_short = ${birth ? shortPlace(birth.place_text) : null},
      death_place_short = ${death ? shortPlace(death.place_text) : null}
    WHERE id = ${personId}::uuid
  `;
}

async function insertEvent(
  pg: Client,
  treeId: string,
  actor: string,
  opts: {
    personId?: string | null;
    familyId?: string | null;
    type: string;
    dateText?: string;
    placeText?: string;
    description?: string;
    title?: string;
  },
) {
  const parsed = parseGenDate(opts.dateText || "");
  const r = await pg.queryObject<Record<string, unknown>>`
    INSERT INTO familytree.events (
      tree_id, person_id, family_id, type, title, date_text, date_sort, date_end_sort,
      date_qualifier, place_text, description, created_by, updated_by
    ) VALUES (
      ${treeId}::uuid,
      ${opts.personId || null}::uuid,
      ${opts.familyId || null}::uuid,
      ${opts.type},
      ${opts.title || null},
      ${parsed ? parsed.text : (opts.dateText || null)},
      ${parsed && parsed.sort ? parsed.sort : null}::date,
      ${parsed && parsed.end ? parsed.end : null}::date,
      ${parsed ? parsed.qualifier : "unknown"},
      ${opts.placeText || null},
      ${opts.description || null},
      ${actor},
      ${actor}
    )
    RETURNING *
  `;
  return r.rows[0];
}

export async function listPersons(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 500));
  const offset = Math.max(0, Number(body.offset) || 0);
  const q = String(body.q || "").trim();
  const surname = String(body.surname || "").trim();
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT p.*, med.public_url AS thumb_url
    FROM familytree.persons p
    LEFT JOIN familytree.media med
      ON med.id = p.profile_media_id AND med.deleted_at IS NULL
    WHERE p.tree_id = ${tree.id}::uuid AND p.deleted_at IS NULL
    ORDER BY p.surname, p.given_names
  `;
  const limitAge = livingAgeLimit(tree);
  let list = r.rows.map((row) => personSummary(row, limitAge));
  const qLower = q.toLowerCase();
  if (qLower) {
    list = list.filter((p) => {
      const blob = [p.givenNames, p.surname, p.birthSurname, p.nickname, p.birthYear, p.deathYear]
        .filter((x) => x != null)
        .join(" ")
        .toLowerCase();
      return blob.indexOf(qLower) >= 0;
    });
  }
  if (surname) {
    list = list.filter((p) => p.surname === surname || p.birthSurname === surname);
  }
  const livingFilter = String(body.living || "");
  if (livingFilter === "true" || livingFilter === "1") list = list.filter((p) => p.living);
  if (livingFilter === "false" || livingFilter === "0") list = list.filter((p) => !p.living);
  if (String(body.hasPhoto || "") === "true") list = list.filter((p) => !!p.thumbUrl);
  if (String(body.missing || "") === "true") {
    list = list.filter((p) => !p.birthYear || (!p.living && !p.deathYear));
  }
  const total = list.length;
  return { persons: list.slice(offset, offset + limit), total };
}

type FamilyBundle = {
  id: string;
  relationshipType: string;
  status: string | null;
  notes: string | null;
  partner1: ReturnType<typeof personSummary> | null;
  partner2: ReturnType<typeof personSummary> | null;
  children: Array<ReturnType<typeof personSummary> & { relationType: string }>;
  marriage: Record<string, unknown> | null;
};

async function loadFamilyBundle(
  pg: Client,
  tree: Record<string, unknown>,
  familyId: string,
  personMap: Map<string, Record<string, unknown>>,
): Promise<FamilyBundle | null> {
  const fam = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.families
    WHERE id = ${familyId}::uuid AND tree_id = ${tree.id}::uuid AND deleted_at IS NULL
    LIMIT 1
  `;
  const f = fam.rows[0];
  if (!f) return null;
  const limit = livingAgeLimit(tree);
  const kids = await pg.queryObject<Record<string, unknown>>`
    SELECT fc.child_id, fc.relation_type, fc.seq
    FROM familytree.family_children fc
    WHERE fc.family_id = ${familyId}::uuid
    ORDER BY fc.seq, fc.child_id
  `;
  const children = [];
  for (const k of kids.rows) {
    let row = personMap.get(String(k.child_id));
    if (!row) {
      const loaded = await loadPerson(pg, String(tree.id), String(k.child_id));
      if (loaded) {
        personMap.set(String(loaded.id), loaded);
        row = loaded;
      }
    }
    if (row) children.push({ ...personSummary(row, limit), relationType: String(k.relation_type || "birth") });
  }
  const marr = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.events
    WHERE family_id = ${familyId}::uuid AND type = 'marriage' AND deleted_at IS NULL
    ORDER BY date_sort NULLS LAST
    LIMIT 1
  `;
  const m = marr.rows[0];
  const p1 = f.partner1_id ? personMap.get(String(f.partner1_id)) : null;
  const p2 = f.partner2_id ? personMap.get(String(f.partner2_id)) : null;
  return {
    id: String(f.id),
    relationshipType: String(f.relationship_type || "unknown"),
    status: f.status ? String(f.status) : null,
    notes: f.notes ? String(f.notes) : null,
    partner1: p1 ? personSummary(p1, limit) : null,
    partner2: p2 ? personSummary(p2, limit) : null,
    children,
    marriage: m
      ? {
        id: m.id,
        type: "marriage",
        dateText: m.date_text,
        dateSort: isoDate(m.date_sort),
        dateQualifier: m.date_qualifier,
        placeText: m.place_text,
        description: m.description,
      }
      : null,
  };
}

export async function getPerson(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const id = String(body.id || "");
  if (!id) throw statusErr("Missing person id", 400);
  const person = await loadPerson(pg, String(tree.id), id);
  if (!person) throw statusErr("Person not found", 404);
  const limit = livingAgeLimit(tree);
  const persons = await pg.queryObject<Record<string, unknown>>`
    SELECT p.*, med.public_url AS thumb_url
    FROM familytree.persons p
    LEFT JOIN familytree.media med
      ON med.id = p.profile_media_id AND med.deleted_at IS NULL
    WHERE p.tree_id = ${tree.id}::uuid AND p.deleted_at IS NULL
  `;
  const personMap = new Map(persons.rows.map((p) => [String(p.id), p]));
  const events = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.events
    WHERE person_id = ${id}::uuid AND deleted_at IS NULL
    ORDER BY date_sort NULLS LAST, created_at
  `;
  const parentLinks = await pg.queryObject<Record<string, unknown>>`
    SELECT family_id FROM familytree.family_children WHERE child_id = ${id}::uuid
  `;
  const parents: FamilyBundle[] = [];
  for (const pl of parentLinks.rows) {
    const b = await loadFamilyBundle(pg, tree, String(pl.family_id), personMap);
    if (b) parents.push(b);
  }
  const spouseRows = await pg.queryObject<Record<string, unknown>>`
    SELECT id FROM familytree.families
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL
      AND (partner1_id = ${id}::uuid OR partner2_id = ${id}::uuid)
  `;
  const families: FamilyBundle[] = [];
  for (const s of spouseRows.rows) {
    const b = await loadFamilyBundle(pg, tree, String(s.id), personMap);
    if (b) families.push(b);
  }
  const notes = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.notes
    WHERE tree_id = ${tree.id}::uuid AND target_type = 'person' AND target_id = ${id}::uuid
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `;
  const eventOut = events.rows.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    dateText: e.date_text,
    dateSort: isoDate(e.date_sort),
    dateQualifier: e.date_qualifier,
    placeText: e.place_text,
    description: e.description,
  }));
  return {
    person: {
      ...personSummary(person, limit),
      bio: person.bio || null,
      privacy: person.privacy || "normal",
    },
    events: eventOut,
    parents,
    families,
    notes: notes.rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      body: n.body,
      createdBy: n.created_by,
      createdAt: n.created_at,
    })),
    media: [],
  };
}

function personInput(body: Record<string, unknown>) {
  const src = (body.person && typeof body.person === "object" ? body.person : body) as Record<string, unknown>;
  const given = String(src.givenNames || src.given || "").trim();
  const surname = String(src.surname || "").trim();
  const sex = String(src.sex || "U");
  if (!given) throw statusErr("Given names are required", 400);
  if (sex !== "M" && sex !== "F" && sex !== "U") throw statusErr("sex must be M, F or U", 400);
  let isLiving: boolean | null = null;
  if (src.isLiving === true || src.living === true) isLiving = true;
  if (src.isLiving === false || src.living === false) isLiving = false;
  return {
    givenNames: given.slice(0, 120),
    surname: surname.slice(0, 80),
    birthSurname: String(src.birthSurname || "").trim().slice(0, 80) || null,
    nickname: String(src.nickname || "").trim().slice(0, 80) || null,
    suffix: String(src.suffix || "").trim().slice(0, 20) || null,
    sex,
    isLiving,
    bio: String(src.bio || "").trim() || null,
  };
}

function eventInput(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const dateText = String(e.dateText || e.date || "").trim();
  const placeText = String(e.placeText || e.place || "").trim();
  const description = String(e.description || "").trim();
  if (!dateText && !placeText && !description) return null;
  return { dateText, placeText, description };
}

export async function createPerson(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const input = personInput(body);
  const actor = String(auth.contributor.display_name);
  const birth = eventInput(body.birth);
  const death = input.isLiving === false ? eventInput(body.death) : null;
  await pg.queryArray`BEGIN`;
  try {
    const ins = await pg.queryObject<Record<string, unknown>>`
      INSERT INTO familytree.persons (
        tree_id, given_names, surname, birth_surname, nickname, suffix, sex, is_living, bio, created_by, updated_by
      ) VALUES (
        ${tree.id}::uuid, ${input.givenNames}, ${input.surname}, ${input.birthSurname},
        ${input.nickname}, ${input.suffix}, ${input.sex}, ${input.isLiving}, ${input.bio}, ${actor}, ${actor}
      )
      RETURNING *
    `;
    const person = ins.rows[0];
    if (birth) {
      await insertEvent(pg, String(tree.id), actor, {
        personId: String(person.id),
        type: "birth",
        dateText: birth.dateText,
        placeText: birth.placeText,
      });
    }
    if (death) {
      await insertEvent(pg, String(tree.id), actor, {
        personId: String(person.id),
        type: "death",
        dateText: death.dateText,
        placeText: death.placeText,
      });
    }
    const noteBody = String(body.note || "").trim();
    if (noteBody) {
      await pg.queryArray`
        INSERT INTO familytree.notes (tree_id, target_type, target_id, kind, body, created_by, updated_by)
        VALUES (${tree.id}::uuid, 'person', ${person.id}::uuid, 'note', ${noteBody}, ${actor}, ${actor})
      `;
    }
    await refreshPersonCache(pg, String(person.id));
    const after = await loadPerson(pg, String(tree.id), String(person.id));
    await writeLog(pg, {
      treeId: String(tree.id),
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "create",
      targetType: "persons",
      targetId: String(person.id),
      summary: `Added ${displayName(after || person)}` + (birth && birth.dateText ? ` (b. ${birth.dateText})` : ""),
      after,
    });
    await pg.queryArray`COMMIT`;
    return { person: personSummary(after || person, livingAgeLimit(tree)) };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function upsertVital(
  pg: Client,
  treeId: string,
  personId: string,
  actor: string,
  type: "birth" | "death",
  ev: { dateText: string; placeText: string } | null,
) {
  const existing = await pg.queryObject<Record<string, unknown>>`
    SELECT id FROM familytree.events
    WHERE person_id = ${personId}::uuid AND type = ${type} AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1
  `;
  if (!ev) {
    if (type === "death" && existing.rows[0]) {
      await pg.queryArray`
        UPDATE familytree.events SET deleted_at = now(), updated_by = ${actor}
        WHERE id = ${existing.rows[0].id}::uuid
      `;
    }
    return;
  }
  const parsed = parseGenDate(ev.dateText);
  if (existing.rows[0]) {
    await pg.queryArray`
      UPDATE familytree.events SET
        date_text = ${parsed ? parsed.text : ev.dateText || null},
        date_sort = ${parsed && parsed.sort ? parsed.sort : null}::date,
        date_end_sort = ${parsed && parsed.end ? parsed.end : null}::date,
        date_qualifier = ${parsed ? parsed.qualifier : "unknown"},
        place_text = ${ev.placeText || null},
        updated_by = ${actor}
      WHERE id = ${existing.rows[0].id}::uuid
    `;
  } else {
    await insertEvent(pg, treeId, actor, {
      personId,
      type,
      dateText: ev.dateText,
      placeText: ev.placeText,
    });
  }
}

export async function updatePerson(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const id = String(body.id || "");
  const before = await loadPerson(pg, String(tree.id), id);
  if (!before) throw statusErr("Person not found", 404);
  const input = personInput(body);
  const actor = String(auth.contributor.display_name);
  await pg.queryArray`BEGIN`;
  try {
    await pg.queryArray`
      UPDATE familytree.persons SET
        given_names = ${input.givenNames},
        surname = ${input.surname},
        birth_surname = ${input.birthSurname},
        nickname = ${input.nickname},
        suffix = ${input.suffix},
        sex = ${input.sex},
        is_living = ${input.isLiving},
        bio = ${input.bio},
        updated_by = ${actor}
      WHERE id = ${id}::uuid
    `;
    if (body.birth !== undefined) {
      await upsertVital(pg, String(tree.id), id, actor, "birth", eventInput(body.birth));
    }
    if (input.isLiving === true) {
      await upsertVital(pg, String(tree.id), id, actor, "death", null);
    } else if (body.death !== undefined) {
      await upsertVital(pg, String(tree.id), id, actor, "death", eventInput(body.death));
    }
    await refreshPersonCache(pg, id);
    const after = await loadPerson(pg, String(tree.id), id);
    await writeLog(pg, {
      treeId: String(tree.id),
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "update",
      targetType: "persons",
      targetId: id,
      summary: `Updated ${displayName(after || before)}`,
      before,
      after,
    });
    await pg.queryArray`COMMIT`;
    return { person: personSummary(after || before, livingAgeLimit(tree)) };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function deletePerson(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const id = String(body.id || "");
  const before = await loadPerson(pg, String(tree.id), id);
  if (!before) throw statusErr("Person not found", 404);
  const actor = String(auth.contributor.display_name);
  await pg.queryArray`
    UPDATE familytree.persons SET deleted_at = now(), updated_by = ${actor}
    WHERE id = ${id}::uuid
  `;
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "delete",
    targetType: "persons",
    targetId: id,
    summary: `Deleted ${displayName(before)}`,
    before,
  });
  return { ok: true };
}

export async function createFamily(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const actor = String(auth.contributor.display_name);
  const p1 = body.partner1Id ? String(body.partner1Id) : null;
  const p2 = body.partner2Id ? String(body.partner2Id) : null;
  const rel = String(body.relationshipType || "unknown");
  if (!["married", "partners", "unknown"].includes(rel)) throw statusErr("Invalid relationship type", 400);
  if (!p1 && !p2) throw statusErr("A family needs at least one partner", 400);
  const ins = await pg.queryObject<Record<string, unknown>>`
    INSERT INTO familytree.families (tree_id, partner1_id, partner2_id, relationship_type, created_by, updated_by)
    VALUES (${tree.id}::uuid, ${p1}::uuid, ${p2}::uuid, ${rel}, ${actor}, ${actor})
    RETURNING *
  `;
  const fam = ins.rows[0];
  const marriage = eventInput(body.marriage);
  if (marriage) {
    await insertEvent(pg, String(tree.id), actor, {
      familyId: String(fam.id),
      type: "marriage",
      dateText: marriage.dateText,
      placeText: marriage.placeText,
    });
  }
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "create",
    targetType: "families",
    targetId: String(fam.id),
    summary: "Added a family",
    after: fam,
  });
  return { family: { id: fam.id, partner1Id: fam.partner1_id, partner2Id: fam.partner2_id, relationshipType: fam.relationship_type } };
}

export async function updateFamily(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const id = String(body.id || "");
  const before = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.families
    WHERE id = ${id}::uuid AND tree_id = ${tree.id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  if (!before.rows[0]) throw statusErr("Family not found", 404);
  const patch = (body.patch || body) as Record<string, unknown>;
  const rel = patch.relationshipType != null ? String(patch.relationshipType) : String(before.rows[0].relationship_type);
  const status = patch.status != null ? String(patch.status) : (before.rows[0].status as string | null);
  const notes = patch.notes != null ? String(patch.notes) : (before.rows[0].notes as string | null);
  const actor = String(auth.contributor.display_name);
  const upd = await pg.queryObject<Record<string, unknown>>`
    UPDATE familytree.families SET
      relationship_type = ${rel},
      status = ${status || null},
      notes = ${notes || null},
      updated_by = ${actor}
    WHERE id = ${id}::uuid
    RETURNING *
  `;
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "update",
    targetType: "families",
    targetId: id,
    summary: "Updated a family",
    before: before.rows[0],
    after: upd.rows[0],
  });
  return { family: upd.rows[0] };
}

export async function addChild(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const familyId = String(body.familyId || "");
  let childId = String(body.childId || "");
  const actor = String(auth.contributor.display_name);
  if (body.child && typeof body.child === "object" && !childId) {
    const childBody = body.child as Record<string, unknown>;
    const created = await createPerson(pg, tree, auth, {
      person: childBody,
      birth: body.birth || childBody.birth,
      death: body.death || childBody.death,
    });
    childId = String(created.person.id);
  }
  if (!familyId || !childId) throw statusErr("familyId and childId are required", 400);
  const fam = await pg.queryObject<Record<string, unknown>>`
    SELECT id FROM familytree.families
    WHERE id = ${familyId}::uuid AND tree_id = ${tree.id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  if (!fam.rows[0]) throw statusErr("Family not found", 404);
  const child = await loadPerson(pg, String(tree.id), childId);
  if (!child) throw statusErr("Child not found", 404);
  const rel = String(body.relationType || "birth");
  const seqRow = await pg.queryObject<{ n: number }>`
    SELECT coalesce(max(seq), -1) + 1 AS n FROM familytree.family_children WHERE family_id = ${familyId}::uuid
  `;
  await pg.queryArray`
    INSERT INTO familytree.family_children (family_id, child_id, relation_type, seq)
    VALUES (${familyId}::uuid, ${childId}::uuid, ${rel}, ${Number(seqRow.rows[0]?.n || 0)})
    ON CONFLICT (family_id, child_id) DO UPDATE SET relation_type = EXCLUDED.relation_type
  `;
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "update",
    targetType: "families",
    targetId: familyId,
    summary: `Linked ${displayName(child)} as a child`,
    after: { familyId, childId, relationType: rel },
  });
  return { ok: true, childId, familyId };
}

export async function removeChild(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const familyId = String(body.familyId || "");
  const childId = String(body.childId || "");
  await pg.queryArray`
    DELETE FROM familytree.family_children
    WHERE family_id = ${familyId}::uuid AND child_id = ${childId}::uuid
  `;
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: String(auth.contributor.display_name),
    action: "update",
    targetType: "families",
    targetId: familyId,
    summary: "Unlinked a child from a family",
    before: { familyId, childId },
  });
  return { ok: true };
}

export async function reorderChildren(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const familyId = String(body.familyId || "");
  const ids = Array.isArray(body.childIds) ? body.childIds.map(String) : [];
  for (let i = 0; i < ids.length; i++) {
    await pg.queryArray`
      UPDATE familytree.family_children SET seq = ${i}
      WHERE family_id = ${familyId}::uuid AND child_id = ${ids[i]}::uuid
    `;
  }
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: String(auth.contributor.display_name),
    action: "update",
    targetType: "families",
    targetId: familyId,
    summary: "Reordered children",
    after: { childIds: ids },
  });
  return { ok: true };
}

async function ensurePersonFromParentArg(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  parent: Record<string, unknown>,
) {
  if (parent.existingId) {
    const p = await loadPerson(pg, String(tree.id), String(parent.existingId));
    if (!p) throw statusErr("Parent not found", 404);
    return p;
  }
  const created = await createPerson(pg, tree, auth, { person: parent.new || parent, birth: parent.birth, death: parent.death });
  const loaded = await loadPerson(pg, String(tree.id), String(created.person.id));
  if (!loaded) throw statusErr("Could not create parent", 500);
  return loaded;
}

export async function addParentToPerson(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const childId = String(body.childId || "");
  const child = await loadPerson(pg, String(tree.id), childId);
  if (!child) throw statusErr("Person not found", 404);
  const parentArg = (body.parent && typeof body.parent === "object" ? body.parent : body) as Record<string, unknown>;
  const parent = await ensurePersonFromParentArg(pg, tree, auth, parentArg);
  const preferredSex = String(body.sex || parent.sex || "U");
  const links = await pg.queryObject<Record<string, unknown>>`
    SELECT f.*
    FROM familytree.family_children fc
    JOIN familytree.families f ON f.id = fc.family_id
    WHERE fc.child_id = ${childId}::uuid AND f.deleted_at IS NULL
    LIMIT 1
  `;
  let familyId: string;
  const actor = String(auth.contributor.display_name);
  if (!links.rows[0]) {
    const p1 = preferredSex === "F" ? null : String(parent.id);
    const p2 = preferredSex === "F" ? String(parent.id) : null;
    const fam = await pg.queryObject<Record<string, unknown>>`
      INSERT INTO familytree.families (tree_id, partner1_id, partner2_id, relationship_type, created_by, updated_by)
      VALUES (${tree.id}::uuid, ${p1}::uuid, ${p2}::uuid, 'unknown', ${actor}, ${actor})
      RETURNING id
    `;
    familyId = String(fam.rows[0].id);
    await pg.queryArray`
      INSERT INTO familytree.family_children (family_id, child_id, relation_type, seq)
      VALUES (${familyId}::uuid, ${childId}::uuid, 'birth', 0)
      ON CONFLICT DO NOTHING
    `;
  } else {
    const fam = links.rows[0];
    familyId = String(fam.id);
    if (String(fam.partner1_id) === String(parent.id) || String(fam.partner2_id) === String(parent.id)) {
      return { familyId, parentId: parent.id };
    }
    if (!fam.partner1_id) {
      await pg.queryArray`UPDATE familytree.families SET partner1_id = ${parent.id}::uuid, updated_by = ${actor} WHERE id = ${familyId}::uuid`;
    } else if (!fam.partner2_id) {
      await pg.queryArray`UPDATE familytree.families SET partner2_id = ${parent.id}::uuid, updated_by = ${actor} WHERE id = ${familyId}::uuid`;
    } else {
      throw statusErr("This person already has two parents recorded", 400);
    }
  }
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "update",
    targetType: "persons",
    targetId: childId,
    summary: `Linked ${displayName(parent)} as a parent of ${displayName(child)}`,
    after: { familyId, parentId: parent.id },
  });
  return { familyId, parentId: parent.id };
}

export async function createEvent(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const personId = body.personId ? String(body.personId) : null;
  const familyId = body.familyId ? String(body.familyId) : null;
  const type = String(body.type || "");
  if (!personId && !familyId) throw statusErr("personId or familyId is required", 400);
  if (!type) throw statusErr("Event type is required", 400);
  const actor = String(auth.contributor.display_name);
  const ev = await insertEvent(pg, String(tree.id), actor, {
    personId,
    familyId,
    type,
    dateText: String(body.dateText || ""),
    placeText: String(body.placeText || ""),
    description: String(body.description || ""),
    title: String(body.title || ""),
  });
  if (personId) await refreshPersonCache(pg, personId);
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "create",
    targetType: "events",
    targetId: String(ev.id),
    summary: `Added ${type} event`,
    after: ev,
  });
  return { event: ev };
}

export async function updateEvent(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const id = String(body.id || "");
  const before = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.events WHERE id = ${id}::uuid AND tree_id = ${tree.id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  if (!before.rows[0]) throw statusErr("Event not found", 404);
  const parsed = parseGenDate(body.dateText != null ? body.dateText : before.rows[0].date_text);
  const actor = String(auth.contributor.display_name);
  const place = body.placeText != null ? String(body.placeText) : String(before.rows[0].place_text || "");
  const desc = body.description != null ? String(body.description) : String(before.rows[0].description || "");
  const upd = await pg.queryObject<Record<string, unknown>>`
    UPDATE familytree.events SET
      date_text = ${parsed ? parsed.text : null},
      date_sort = ${parsed && parsed.sort ? parsed.sort : null}::date,
      date_end_sort = ${parsed && parsed.end ? parsed.end : null}::date,
      date_qualifier = ${parsed ? parsed.qualifier : "unknown"},
      place_text = ${place || null},
      description = ${desc || null},
      updated_by = ${actor}
    WHERE id = ${id}::uuid
    RETURNING *
  `;
  if (upd.rows[0].person_id) await refreshPersonCache(pg, String(upd.rows[0].person_id));
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "update",
    targetType: "events",
    targetId: id,
    summary: "Updated an event",
    before: before.rows[0],
    after: upd.rows[0],
  });
  return { event: upd.rows[0] };
}

export async function deleteEvent(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const id = String(body.id || "");
  const before = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.events WHERE id = ${id}::uuid AND tree_id = ${tree.id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  if (!before.rows[0]) throw statusErr("Event not found", 404);
  const actor = String(auth.contributor.display_name);
  await pg.queryArray`
    UPDATE familytree.events SET deleted_at = now(), updated_by = ${actor} WHERE id = ${id}::uuid
  `;
  if (before.rows[0].person_id) await refreshPersonCache(pg, String(before.rows[0].person_id));
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "delete",
    targetType: "events",
    targetId: id,
    summary: "Deleted an event",
    before: before.rows[0],
  });
  return { ok: true };
}

export async function createNote(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const targetType = String(body.targetType || "person");
  const targetId = String(body.targetId || "");
  const kind = String(body.kind || "note");
  const noteBody = String(body.body || "").trim();
  if (!targetId || !noteBody) throw statusErr("Note text is required", 400);
  const actor = String(auth.contributor.display_name);
  const ins = await pg.queryObject<Record<string, unknown>>`
    INSERT INTO familytree.notes (tree_id, target_type, target_id, kind, body, created_by, updated_by)
    VALUES (${tree.id}::uuid, ${targetType}, ${targetId}::uuid, ${kind}, ${noteBody}, ${actor}, ${actor})
    RETURNING *
  `;
  await writeLog(pg, {
    treeId: String(tree.id),
    actorId: String(auth.contributor.id),
    actorName: actor,
    action: "create",
    targetType: "notes",
    targetId: String(ins.rows[0].id),
    summary: "Added a note",
    after: ins.rows[0],
  });
  return { note: ins.rows[0] };
}

export async function setSelfPerson(
  pg: Client,
  tree: Record<string, unknown>,
  auth: { contributor: Record<string, unknown> },
  body: Record<string, unknown>,
) {
  const personId = body.personId ? String(body.personId) : null;
  if (personId) {
    const p = await loadPerson(pg, String(tree.id), personId);
    if (!p) throw statusErr("Person not found", 404);
  }
  await pg.queryArray`
    UPDATE familytree.contributors
    SET self_person_id = ${personId}::uuid
    WHERE id = ${auth.contributor.id}::uuid
  `;
  return { ok: true, selfPersonId: personId };
}

type TreeIndex = {
  personById: Map<string, Record<string, unknown>>;
  famById: Map<string, Record<string, unknown>>;
  children: Record<string, unknown>[];
  byChild: Map<string, Record<string, unknown>[]>;
  byPartner: Map<string, string[]>;
};

async function loadIndex(pg: Client, treeId: string): Promise<TreeIndex> {
  const persons = await pg.queryObject<Record<string, unknown>>`
    SELECT p.*, med.public_url AS thumb_url
    FROM familytree.persons p
    LEFT JOIN familytree.media med
      ON med.id = p.profile_media_id AND med.deleted_at IS NULL
    WHERE p.tree_id = ${treeId}::uuid AND p.deleted_at IS NULL
  `;
  const families = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.families WHERE tree_id = ${treeId}::uuid AND deleted_at IS NULL
  `;
  const children = await pg.queryObject<Record<string, unknown>>`
    SELECT fc.family_id, fc.child_id, fc.relation_type, fc.seq
    FROM familytree.family_children fc
    JOIN familytree.families f ON f.id = fc.family_id
    WHERE f.tree_id = ${treeId}::uuid AND f.deleted_at IS NULL
  `;
  const personById = new Map(persons.rows.map((p) => [String(p.id), p]));
  const famById = new Map(families.rows.map((f) => [String(f.id), f]));
  const byChild = new Map<string, Record<string, unknown>[]>();
  const byPartner = new Map<string, string[]>();
  for (const c of children.rows) {
    const id = String(c.child_id);
    const arr = byChild.get(id) || [];
    arr.push(c);
    byChild.set(id, arr);
  }
  for (const f of families.rows) {
    for (const pid of [f.partner1_id, f.partner2_id]) {
      if (!pid) continue;
      const id = String(pid);
      const arr = byPartner.get(id) || [];
      arr.push(String(f.id));
      byPartner.set(id, arr);
    }
  }
  return { personById, famById, children: children.rows, byChild, byPartner };
}

function collectAncestors(index: TreeIndex, focusId: string, gens: number) {
  const needed = new Set<string>([focusId]);
  let frontier = [focusId];
  for (let g = 0; g < gens - 1; g++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const link of index.byChild.get(id) || []) {
        const fam = index.famById.get(String(link.family_id));
        if (!fam) continue;
        for (const pid of [fam.partner1_id, fam.partner2_id]) {
          if (pid && !needed.has(String(pid))) {
            needed.add(String(pid));
            next.push(String(pid));
          }
        }
      }
    }
    frontier = next;
  }
  return needed;
}

function collectDescendants(index: TreeIndex, focusId: string, gens: number) {
  const needed = new Set<string>([focusId]);
  let frontier = [focusId];
  for (let g = 0; g < gens - 1; g++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const fid of index.byPartner.get(id) || []) {
        const fam = index.famById.get(fid);
        if (!fam) continue;
        for (const pid of [fam.partner1_id, fam.partner2_id]) {
          if (pid) needed.add(String(pid));
        }
        for (const c of index.children) {
          if (String(c.family_id) !== fid) continue;
          const cid = String(c.child_id);
          if (!needed.has(cid)) {
            needed.add(cid);
            next.push(cid);
          }
        }
      }
    }
    frontier = next;
  }
  return needed;
}

function chartPayload(
  index: TreeIndex,
  tree: Record<string, unknown>,
  focusId: string,
  needed: Set<string>,
  extra: Record<string, unknown>,
) {
  const limit = livingAgeLimit(tree);
  const persons = Array.from(needed)
    .map((id) => index.personById.get(id))
    .filter(Boolean)
    .map((p) => personSummary(p as Record<string, unknown>, limit));
  const familyIds = new Set<string>();
  for (const id of needed) {
    for (const link of index.byChild.get(id) || []) familyIds.add(String(link.family_id));
    for (const fid of index.byPartner.get(id) || []) familyIds.add(fid);
  }
  const families = Array.from(familyIds).map((fid) => {
    const f = index.famById.get(fid)!;
    const kids = index.children
      .filter((c) => String(c.family_id) === fid)
      .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
      .map((c) => ({
        id: c.child_id,
        relationType: c.relation_type,
        seq: Number(c.seq) || 0,
      }));
    return {
      id: f.id,
      partner1Id: f.partner1_id,
      partner2Id: f.partner2_id,
      relationshipType: f.relationship_type,
      children: kids,
    };
  });
  return { focusId, persons, families, ...extra };
}

function kinGraph(index: TreeIndex, limit: number): KinGraph {
  const parents = new Map<string, { fatherId: string | null; motherId: string | null }>();
  const partners = new Map<string, string[]>();
  for (const f of index.famById.values()) {
    const p1 = f.partner1_id ? String(f.partner1_id) : null;
    const p2 = f.partner2_id ? String(f.partner2_id) : null;
    if (p1 && p2) {
      partners.set(p1, (partners.get(p1) || []).concat(p2));
      partners.set(p2, (partners.get(p2) || []).concat(p1));
    }
    const kids = index.children.filter((c) => String(c.family_id) === String(f.id));
    for (const kid of kids) {
      const cid = String(kid.child_id);
      const cur = parents.get(cid) || { fatherId: null, motherId: null };
      for (const pid of [p1, p2]) {
        if (!pid) continue;
        const row = index.personById.get(pid);
        if (!row) continue;
        const sex = String(row.sex || "U");
        if (sex === "F" && !cur.motherId) cur.motherId = pid;
        else if (sex === "M" && !cur.fatherId) cur.fatherId = pid;
        else if (!cur.fatherId) cur.fatherId = pid;
        else if (!cur.motherId) cur.motherId = pid;
      }
      parents.set(cid, cur);
    }
  }
  return {
    person(id: string): KinPerson | null {
      const row = index.personById.get(id);
      if (!row) return null;
      const summary = personSummary(row, limit);
      return {
        id: String(summary.id),
        sex: String(summary.sex || "U"),
        givenNames: String(summary.givenNames || ""),
        surname: String(summary.surname || ""),
        birthSurname: summary.birthSurname ? String(summary.birthSurname) : null,
      };
    },
    parentsOf(id: string) {
      return parents.get(id) || { fatherId: null, motherId: null };
    },
    partnersOf(id: string) {
      const seen = new Set<string>();
      return (partners.get(id) || []).filter((pid) => {
        if (seen.has(pid) || !index.personById.has(pid)) return false;
        seen.add(pid);
        return true;
      });
    },
  };
}

async function requireFocus(pg: Client, tree: Record<string, unknown>, body: Record<string, unknown>) {
  const focusId = String(body.focusId || body.id || "");
  if (!focusId) throw statusErr("focusId is required", 400);
  const focus = await loadPerson(pg, String(tree.id), focusId);
  if (!focus) throw statusErr("Person not found", 404);
  return focusId;
}

export async function getPedigree(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const focusId = await requireFocus(pg, tree, body);
  const gens = Math.max(2, Math.min(8, Number(body.generations) || 4));
  const index = await loadIndex(pg, String(tree.id));
  return chartPayload(index, tree, focusId, collectAncestors(index, focusId, gens), { generations: gens });
}

export async function getDescendants(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const focusId = await requireFocus(pg, tree, body);
  const gens = Math.max(1, Math.min(8, Number(body.generations) || 4));
  const index = await loadIndex(pg, String(tree.id));
  return chartPayload(index, tree, focusId, collectDescendants(index, focusId, gens), { generations: gens });
}

export async function getHourglass(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const focusId = await requireFocus(pg, tree, body);
  const up = Math.max(2, Math.min(6, Number(body.up) || Number(body.generations) || 4));
  const down = Math.max(1, Math.min(6, Number(body.down) || Number(body.generations) || 4));
  const index = await loadIndex(pg, String(tree.id));
  const needed = collectAncestors(index, focusId, up);
  for (const id of collectDescendants(index, focusId, down)) needed.add(id);
  return chartPayload(index, tree, focusId, needed, { up, down });
}

export async function relationship(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const fromId = String(body.fromId || "");
  const toId = String(body.toId || "");
  if (!fromId || !toId) throw statusErr("fromId and toId are required", 400);
  const index = await loadIndex(pg, String(tree.id));
  if (!index.personById.has(fromId) || !index.personById.has(toId)) {
    throw statusErr("Person not found", 404);
  }
  const limit = livingAgeLimit(tree);
  const graph = kinGraph(index, limit);
  const rel = relate(fromId, toId, graph);
  const summaries = (ids: string[]) =>
    ids
      .map((id) => index.personById.get(id))
      .filter(Boolean)
      .map((row) => personSummary(row as Record<string, unknown>, limit));
  return {
    fromId,
    toId,
    term: rel.term,
    phrase: phrase(graph.person(fromId), graph.person(toId), rel),
    same: !!rel.same,
    unrelated: !!rel.unrelated,
    description: rel.description,
    path: summaries(rel.path),
    commonAncestors: summaries(rel.commonAncestorIds),
  };
}

export async function getTimeline(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const personId = String(body.personId || body.id || "");
  if (!personId) throw statusErr("personId is required", 400);
  const person = await loadPerson(pg, String(tree.id), personId);
  if (!person) throw statusErr("Person not found", 404);
  const events = await pg.queryObject<Record<string, unknown>>`
    SELECT e.* FROM familytree.events e
    WHERE e.deleted_at IS NULL AND e.tree_id = ${tree.id}::uuid
      AND (
        e.person_id = ${personId}::uuid
        OR e.family_id IN (
          SELECT id FROM familytree.families
          WHERE deleted_at IS NULL
            AND (partner1_id = ${personId}::uuid OR partner2_id = ${personId}::uuid)
        )
      )
    ORDER BY e.date_sort NULLS LAST, e.created_at
  `;
  const media = await pg.queryObject<Record<string, unknown>>`
    SELECT m.id, m.public_url, m.kind, m.title, m.caption, m.date_text, m.date_sort, m.date_qualifier, m.place_text
    FROM familytree.media m
    WHERE m.tree_id = ${tree.id}::uuid AND m.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM familytree.media_links ml
        WHERE ml.media_id = m.id AND ml.target_type = 'person' AND ml.target_id = ${personId}::uuid
      )
    ORDER BY m.date_sort NULLS LAST, m.created_at
  `;
  const items: Record<string, unknown>[] = [];
  for (const e of events.rows) {
    items.push({
      kind: "event",
      id: e.id,
      type: e.type,
      title: e.title,
      dateText: e.date_text,
      dateSort: isoDate(e.date_sort),
      dateQualifier: e.date_qualifier,
      placeText: e.place_text,
      description: e.description,
    });
  }
  for (const m of media.rows) {
    items.push({
      kind: "media",
      id: m.id,
      mediaKind: m.kind,
      title: m.title,
      caption: m.caption,
      url: m.public_url,
      dateText: m.date_text,
      dateSort: isoDate(m.date_sort),
      dateQualifier: m.date_qualifier,
      placeText: m.place_text,
    });
  }
  items.sort((a, b) => {
    const as = String(a.dateSort || "");
    const bs = String(b.dateSort || "");
    if (as && !bs) return -1;
    if (!as && bs) return 1;
    if (as !== bs) return as < bs ? -1 : 1;
    return String(a.kind) === "event" ? -1 : 1;
  });
  return {
    person: personSummary(person, livingAgeLimit(tree)),
    items,
  };
}

export async function onThisDay(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const now = new Date();
  const month = Math.min(12, Math.max(1, Number(body.month) || (now.getUTCMonth() + 1)));
  const day = Math.min(31, Math.max(1, Number(body.day) || now.getUTCDate()));
  const events = await pg.queryObject<Record<string, unknown>>`
    SELECT e.id, e.type, e.title, e.date_text, e.date_sort, e.place_text,
           p.id AS person_id, p.given_names, p.surname, p.sex, p.birth_year, p.death_year, p.is_living
    FROM familytree.events e
    JOIN familytree.persons p ON p.id = e.person_id AND p.deleted_at IS NULL
    WHERE e.tree_id = ${tree.id}::uuid AND e.deleted_at IS NULL
      AND e.date_qualifier = 'exact' AND e.date_sort IS NOT NULL
      AND EXTRACT(MONTH FROM e.date_sort)::int = ${month}
      AND EXTRACT(DAY FROM e.date_sort)::int = ${day}
      AND coalesce(p.privacy, 'normal') <> 'private'
  `;
  const unions = await pg.queryObject<Record<string, unknown>>`
    SELECT e.id, e.type, e.title, e.date_text, e.date_sort, e.place_text,
           p1.id AS id1, p1.given_names AS g1, p1.surname AS s1,
           p2.id AS id2, p2.given_names AS g2, p2.surname AS s2
    FROM familytree.events e
    JOIN familytree.families f ON f.id = e.family_id AND f.deleted_at IS NULL
    LEFT JOIN familytree.persons p1 ON p1.id = f.partner1_id AND p1.deleted_at IS NULL
    LEFT JOIN familytree.persons p2 ON p2.id = f.partner2_id AND p2.deleted_at IS NULL
    WHERE e.tree_id = ${tree.id}::uuid AND e.deleted_at IS NULL
      AND e.date_qualifier = 'exact' AND e.date_sort IS NOT NULL
      AND EXTRACT(MONTH FROM e.date_sort)::int = ${month}
      AND EXTRACT(DAY FROM e.date_sort)::int = ${day}
  `;
  const photos = await pg.queryObject<Record<string, unknown>>`
    SELECT m.id, m.title, m.kind, m.date_text, m.date_sort, m.public_url
    FROM familytree.media m
    WHERE m.tree_id = ${tree.id}::uuid AND m.deleted_at IS NULL
      AND m.date_qualifier = 'exact' AND m.date_sort IS NOT NULL
      AND EXTRACT(MONTH FROM m.date_sort)::int = ${month}
      AND EXTRACT(DAY FROM m.date_sort)::int = ${day}
  `;
  const yearOf = (v: unknown) => {
    const s = isoDate(v);
    return s ? Number(s.slice(0, 4)) : null;
  };
  const thisYear = now.getUTCFullYear();
  const items: Record<string, unknown>[] = [];
  for (const e of events.rows) {
    const year = yearOf(e.date_sort);
    items.push({
      kind: "event",
      id: e.id,
      type: e.type,
      title: e.title,
      dateText: e.date_text,
      placeText: e.place_text,
      year,
      yearsAgo: year ? thisYear - year : null,
      personId: e.person_id,
      givenNames: e.given_names,
      surname: e.surname,
    });
  }
  for (const e of unions.rows) {
    const year = yearOf(e.date_sort);
    const names = [[e.g1, e.s1].filter(Boolean).join(" "), [e.g2, e.s2].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" and ");
    items.push({
      kind: "event",
      id: e.id,
      type: e.type,
      title: e.title,
      dateText: e.date_text,
      placeText: e.place_text,
      year,
      yearsAgo: year ? thisYear - year : null,
      personId: e.id1 || e.id2,
      label: names,
    });
  }
  for (const m of photos.rows) {
    const year = yearOf(m.date_sort);
    items.push({
      kind: "media",
      id: m.id,
      mediaKind: m.kind,
      title: m.title,
      url: m.public_url,
      dateText: m.date_text,
      year,
      yearsAgo: year ? thisYear - year : null,
    });
  }
  items.sort((a, b) => Number(b.yearsAgo || 0) - Number(a.yearsAgo || 0));
  return { month, day, items: items.slice(0, 12) };
}
