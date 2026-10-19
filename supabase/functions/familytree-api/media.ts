/**
 * Photo and document storage for familytree-api.
 * Bytes go to the public `familytree` bucket; rows live in familytree.media.
 */
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { parseGenDate, statusErr, writeLog } from "./genealogy.ts";

const MAX_BYTES = 150 * 1024;
const KINDS = new Set([
  "photo",
  "portrait",
  "document",
  "census",
  "certificate",
  "grave",
  "homestead",
  "map",
  "other",
]);
const TARGETS = new Set(["person", "family", "event", "place"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Auth = { contributor: Record<string, unknown> };

type MediaLink = {
  id: string;
  targetType: string;
  targetId: string;
  isPrimary: boolean;
  region: { x: number; y: number; w: number; h: number } | null;
  seq: number;
};

type MediaPerson = {
  id: string;
  givenNames: string;
  surname: string;
  sex: string;
  linkId: string;
  isPrimary: boolean;
  region: MediaLink["region"];
};

export type MediaItem = {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  kind: string;
  title: string;
  caption: string | null;
  dateText: string | null;
  dateSort: string | null;
  dateQualifier: string | null;
  placeText: string | null;
  uploadedBy: string | null;
  createdAt: unknown;
  links: MediaLink[];
  people: MediaPerson[];
};

function json(v: unknown) {
  return JSON.stringify(v ?? null);
}

function actorName(auth: Auth) {
  return String(auth.contributor.display_name || auth.contributor.handle || "");
}

function clip(value: unknown, max: number) {
  const s = String(value == null ? "" : value).replace(/[\u0000-\u001f]/g, " ").trim();
  return s ? s.slice(0, max) : "";
}

function isoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function asRegion(raw: unknown): MediaLink["region"] {
  if (raw == null) return null;
  let o = raw;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const x = Number(r.x);
  const y = Number(r.y);
  const w = Number(r.w);
  const h = Number(r.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return { x, y, w, h };
}

function parseRegion(raw: unknown): MediaLink["region"] {
  if (raw == null || raw === "") return null;
  const box = asRegion(raw);
  if (!box) throw statusErr("region must be {x,y,w,h} fractions", 400);
  if (box.w <= 0 || box.h <= 0 || box.w > 1 || box.h > 1) {
    throw statusErr("region size is out of range", 400);
  }
  if (box.x < 0 || box.y < 0 || box.x > 1 || box.y > 1) {
    throw statusErr("region position is out of range", 400);
  }
  const x = Math.min(Math.max(0, box.x), 1 - box.w);
  const y = Math.min(Math.max(0, box.y), 1 - box.h);
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return { x: round(x), y: round(y), w: round(box.w), h: round(box.h) };
}

function requireUuid(value: unknown, label: string) {
  const id = String(value || "").trim();
  if (!UUID_RE.test(id)) throw statusErr(label + " is not a valid id", 400);
  return id;
}

function decodeBase64(raw: unknown) {
  const text = String(raw || "").trim();
  if (!text) throw statusErr("Missing image data", 400);
  if (text.length > 220000) throw statusErr("Image must be 150 KB or smaller", 400);
  const cleaned = text.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  let bin: string;
  try {
    bin = atob(cleaned);
  } catch {
    throw statusErr("Image data is not valid base64", 400);
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (!bytes.length || bytes.length > MAX_BYTES) {
    throw statusErr("Image must be 150 KB or smaller", 400);
  }
  return bytes;
}

function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

function jpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) + bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return null;
    const sof = (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof) {
      const h = (bytes[i + 5] << 8) + bytes[i + 6];
      const w = (bytes[i + 7] << 8) + bytes[i + 8];
      if (w > 0 && h > 0) return { w, h };
    }
    i += 2 + len;
  }
  return null;
}

function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24) return null;
  const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (w > 0 && h > 0 && w < 20000 && h < 20000) return { w, h };
  return null;
}

function imageSize(bytes: Uint8Array, mime: string, claimedW: unknown, claimedH: unknown) {
  const cw = Number(claimedW);
  const ch = Number(claimedH);
  const claimedOk = Number.isFinite(cw) && Number.isFinite(ch) && cw >= 1 && ch >= 1 && cw <= 20000 && ch <= 20000;
  if (claimedOk) return { w: Math.round(cw), h: Math.round(ch) };
  if (mime === "image/jpeg") return jpegSize(bytes);
  if (mime === "image/png") return pngSize(bytes);
  return null;
}

function storageEnv() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw statusErr("Storage is not configured", 500);
  return { url: url.replace(/\/$/, ""), key };
}

function objectUrl(base: string, path: string, method: string) {
  const encoded = path.split("/").map((part) => encodeURIComponent(part)).join("/");
  return base + "/storage/v1/object/familytree/" + encoded + (method === "GET" ? "" : "");
}

async function putObject(path: string, bytes: Uint8Array, mime: string) {
  const { url, key } = storageEnv();
  const res = await fetch(objectUrl(url, path, "POST"), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      apikey: key,
      "Content-Type": mime,
      "cache-control": "public, max-age=31536000",
    },
    body: bytes,
  });
  if (!res.ok) {
    await res.text();
    throw statusErr("Could not store the image (" + res.status + ")", 500);
  }
  return url + "/storage/v1/object/public/familytree/" + path;
}

async function deleteObject(path: string) {
  const { url, key } = storageEnv();
  await fetch(objectUrl(url, path, "DELETE"), {
    method: "DELETE",
    headers: { Authorization: "Bearer " + key, apikey: key },
  });
}

function shape(row: Record<string, unknown>, linkRows: Record<string, unknown>[]): MediaItem {
  const id = String(row.id);
  const links: MediaLink[] = [];
  const people: MediaPerson[] = [];
  for (const l of linkRows) {
    if (String(l.media_id) !== id) continue;
    const region = asRegion(l.region);
    const link: MediaLink = {
      id: String(l.id),
      targetType: String(l.target_type),
      targetId: String(l.target_id),
      isPrimary: !!l.is_primary,
      region,
      seq: Number(l.seq) || 0,
    };
    links.push(link);
    if (l.target_type === "person" && l.given_names != null) {
      people.push({
        id: String(l.target_id),
        givenNames: String(l.given_names || ""),
        surname: String(l.surname || ""),
        sex: String(l.sex || "U"),
        linkId: link.id,
        isPrimary: link.isPrimary,
        region,
      });
    }
  }
  links.sort((a, b) => a.seq - b.seq);
  return {
    id,
    url: String(row.public_url || ""),
    mimeType: String(row.mime_type || ""),
    byteSize: Number(row.byte_size) || 0,
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    kind: String(row.kind || "photo"),
    title: String(row.title || "Untitled"),
    caption: row.caption ? String(row.caption) : null,
    dateText: row.date_text ? String(row.date_text) : null,
    dateSort: isoDate(row.date_sort),
    dateQualifier: row.date_qualifier ? String(row.date_qualifier) : null,
    placeText: row.place_text ? String(row.place_text) : null,
    uploadedBy: row.uploaded_by ? String(row.uploaded_by) : null,
    createdAt: row.created_at,
    links,
    people,
  };
}

async function linksFor(pg: Client, treeId: string, mediaIds: string[]) {
  if (!mediaIds.length) return [] as Record<string, unknown>[];
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT ml.*, p.given_names, p.surname, p.sex
    FROM familytree.media_links ml
    JOIN familytree.media m ON m.id = ml.media_id
    LEFT JOIN familytree.persons p
      ON ml.target_type = 'person' AND p.id = ml.target_id AND p.deleted_at IS NULL
    WHERE m.tree_id = ${treeId}::uuid AND m.deleted_at IS NULL
    ORDER BY ml.seq, ml.id
  `;
  const want = new Set(mediaIds);
  return r.rows.filter((row) => want.has(String(row.media_id)));
}

async function loadItem(pg: Client, treeId: string, mediaId: string) {
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.media
    WHERE id = ${mediaId}::uuid AND tree_id = ${treeId}::uuid AND deleted_at IS NULL
    LIMIT 1
  `;
  const row = r.rows[0];
  if (!row) throw statusErr("Photo not found", 404);
  const links = await linksFor(pg, treeId, [mediaId]);
  return shape(row, links);
}

async function assertTarget(pg: Client, treeId: string, targetType: string, targetId: string) {
  if (!TARGETS.has(targetType)) throw statusErr("targetType is not supported", 400);
  requireUuid(targetId, "targetId");
  let found = false;
  if (targetType === "person") {
    const r = await pg.queryObject`
      SELECT id FROM familytree.persons
      WHERE id = ${targetId}::uuid AND tree_id = ${treeId}::uuid AND deleted_at IS NULL LIMIT 1
    `;
    found = !!r.rows[0];
  } else if (targetType === "family") {
    const r = await pg.queryObject`
      SELECT id FROM familytree.families
      WHERE id = ${targetId}::uuid AND tree_id = ${treeId}::uuid AND deleted_at IS NULL LIMIT 1
    `;
    found = !!r.rows[0];
  } else if (targetType === "event") {
    const r = await pg.queryObject`
      SELECT id FROM familytree.events
      WHERE id = ${targetId}::uuid AND tree_id = ${treeId}::uuid AND deleted_at IS NULL LIMIT 1
    `;
    found = !!r.rows[0];
  } else {
    const r = await pg.queryObject`
      SELECT id FROM familytree.places
      WHERE id = ${targetId}::uuid AND tree_id = ${treeId}::uuid LIMIT 1
    `;
    found = !!r.rows[0];
  }
  if (!found) throw statusErr("That record is not in this tree", 404);
}

type LinkInput = {
  targetType: string;
  targetId: string;
  isPrimary: boolean;
  region: MediaLink["region"];
};

function readLinks(raw: unknown): LinkInput[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw statusErr("links must be a list", 400);
  if (raw.length > 40) throw statusErr("Too many links on one item", 400);
  return raw.map((item) => {
    if (!item || typeof item !== "object") throw statusErr("Invalid link", 400);
    const o = item as Record<string, unknown>;
    const targetType = String(o.targetType || "");
    const targetId = requireUuid(o.targetId, "targetId");
    if (!TARGETS.has(targetType)) throw statusErr("targetType is not supported", 400);
    return {
      targetType,
      targetId,
      isPrimary: o.isPrimary === true && targetType === "person",
      region: o.region == null ? null : parseRegion(o.region),
    };
  });
}

async function applyPrimary(pg: Client, mediaId: string, personId: string, on: boolean) {
  if (on) {
    await pg.queryArray`
      UPDATE familytree.media_links SET is_primary = false
      WHERE target_type = 'person' AND target_id = ${personId}::uuid AND media_id <> ${mediaId}::uuid
    `;
    await pg.queryArray`
      UPDATE familytree.media_links SET is_primary = true
      WHERE media_id = ${mediaId}::uuid AND target_type = 'person' AND target_id = ${personId}::uuid
    `;
    await pg.queryArray`
      UPDATE familytree.persons SET profile_media_id = ${mediaId}::uuid
      WHERE id = ${personId}::uuid
    `;
  } else {
    await pg.queryArray`
      UPDATE familytree.media_links SET is_primary = false
      WHERE media_id = ${mediaId}::uuid AND target_type = 'person' AND target_id = ${personId}::uuid
    `;
    await pg.queryArray`
      UPDATE familytree.persons SET profile_media_id = NULL
      WHERE id = ${personId}::uuid AND profile_media_id = ${mediaId}::uuid
    `;
  }
}

async function upsertLink(
  pg: Client,
  mediaId: string,
  link: LinkInput,
) {
  const existing = await pg.queryObject<Record<string, unknown>>`
    SELECT id, seq FROM familytree.media_links
    WHERE media_id = ${mediaId}::uuid AND target_type = ${link.targetType} AND target_id = ${link.targetId}::uuid
    LIMIT 1
  `;
  const regionJson = json(link.region);
  if (existing.rows[0]) {
    await pg.queryArray`
      UPDATE familytree.media_links
      SET is_primary = ${link.isPrimary}, region = ${regionJson}::jsonb
      WHERE id = ${existing.rows[0].id}::uuid
    `;
  } else {
    const seqRow = await pg.queryObject<{ n: number }>`
      SELECT coalesce(max(seq), 0)::int + 1 AS n
      FROM familytree.media_links WHERE media_id = ${mediaId}::uuid
    `;
    const seq = Number(seqRow.rows[0]?.n) || 1;
    await pg.queryArray`
      INSERT INTO familytree.media_links (media_id, target_type, target_id, is_primary, region, seq)
      VALUES (
        ${mediaId}::uuid, ${link.targetType}, ${link.targetId}::uuid,
        ${link.isPrimary}, ${regionJson}::jsonb, ${seq}
      )
    `;
  }
  if (link.targetType === "person") {
    await applyPrimary(pg, mediaId, link.targetId, link.isPrimary);
  }
}

function dateParts(dateText: string) {
  const parsed = dateText ? parseGenDate(dateText) : null;
  return {
    text: parsed ? parsed.text : null,
    sort: parsed && parsed.sort ? parsed.sort : null,
    end: parsed && parsed.end ? parsed.end : null,
    qualifier: parsed ? parsed.qualifier : null,
  };
}

export async function uploadMedia(
  pg: Client,
  tree: Record<string, unknown>,
  auth: Auth,
  body: Record<string, unknown>,
) {
  const kind = String(body.kind || "photo");
  if (!KINDS.has(kind)) throw statusErr("Unknown media kind", 400);
  const bytes = decodeBase64(body.base64);
  const sniffed = sniffImage(bytes);
  if (!sniffed) throw statusErr("File must be a JPEG, PNG or WebP image", 400);
  const size = imageSize(bytes, sniffed.mime, body.width, body.height);
  const title = clip(body.title, 160) || "Untitled";
  const caption = clip(body.caption, 2000) || null;
  const placeText = clip(body.placeText, 200) || null;
  const dates = dateParts(clip(body.dateText, 80));
  const links = readLinks(body.links);
  const treeId = String(tree.id);
  for (const link of links) await assertTarget(pg, treeId, link.targetType, link.targetId);

  const id = crypto.randomUUID();
  const path = "trees/" + treeId + "/media/" + id + "." + sniffed.ext;
  const publicUrl = await putObject(path, bytes, sniffed.mime);
  const actor = actorName(auth);
  try {
    await pg.queryArray`BEGIN`;
    await pg.queryArray`
      INSERT INTO familytree.media (
        id, tree_id, storage_path, public_url, mime_type, byte_size, width, height,
        kind, title, caption, date_text, date_sort, date_end_sort, date_qualifier,
        place_text, uploaded_by
      ) VALUES (
        ${id}::uuid, ${treeId}::uuid, ${path}, ${publicUrl}, ${sniffed.mime}, ${bytes.length},
        ${size ? size.w : null}, ${size ? size.h : null},
        ${kind}, ${title}, ${caption},
        ${dates.text}, ${dates.sort}::date, ${dates.end}::date, ${dates.qualifier},
        ${placeText}, ${actor}
      )
    `;
    for (const link of links) await upsertLink(pg, id, link);
    const item = await loadItem(pg, treeId, id);
    await writeLog(pg, {
      treeId,
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "upload",
      targetType: "media",
      targetId: id,
      summary: "Added " + kind + " “" + title + "”",
      after: item,
    });
    await pg.queryArray`COMMIT`;
    return { media: item };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    try {
      await deleteObject(path);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function updateMedia(
  pg: Client,
  tree: Record<string, unknown>,
  auth: Auth,
  body: Record<string, unknown>,
) {
  const id = requireUuid(body.id, "id");
  const treeId = String(tree.id);
  const before = await loadItem(pg, treeId, id);
  const patch = (body.patch && typeof body.patch === "object" ? body.patch : body) as Record<string, unknown>;
  const kind = patch.kind == null ? before.kind : String(patch.kind);
  if (!KINDS.has(kind)) throw statusErr("Unknown media kind", 400);
  const title = patch.title == null ? before.title : (clip(patch.title, 160) || "Untitled");
  const caption = patch.caption == null ? before.caption : (clip(patch.caption, 2000) || null);
  const placeText = patch.placeText == null ? before.placeText : (clip(patch.placeText, 200) || null);
  const dates = patch.dateText == null ? null : dateParts(clip(patch.dateText, 80));
  const actor = actorName(auth);
  await pg.queryArray`BEGIN`;
  try {
    if (dates) {
      await pg.queryArray`
        UPDATE familytree.media SET
          kind = ${kind}, title = ${title}, caption = ${caption}, place_text = ${placeText},
          date_text = ${dates.text}, date_sort = ${dates.sort}::date,
          date_end_sort = ${dates.end}::date, date_qualifier = ${dates.qualifier}
        WHERE id = ${id}::uuid AND tree_id = ${treeId}::uuid
      `;
    } else {
      await pg.queryArray`
        UPDATE familytree.media SET
          kind = ${kind}, title = ${title}, caption = ${caption}, place_text = ${placeText}
        WHERE id = ${id}::uuid AND tree_id = ${treeId}::uuid
      `;
    }
    const after = await loadItem(pg, treeId, id);
    await writeLog(pg, {
      treeId,
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "update",
      targetType: "media",
      targetId: id,
      summary: "Updated " + kind + " “" + title + "”",
      before,
      after,
    });
    await pg.queryArray`COMMIT`;
    return { media: after };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function deleteMedia(
  pg: Client,
  tree: Record<string, unknown>,
  auth: Auth,
  body: Record<string, unknown>,
) {
  const id = requireUuid(body.id, "id");
  const treeId = String(tree.id);
  const before = await loadItem(pg, treeId, id);
  const actor = actorName(auth);
  await pg.queryArray`BEGIN`;
  try {
    await pg.queryArray`
      UPDATE familytree.persons SET profile_media_id = NULL
      WHERE profile_media_id = ${id}::uuid
    `;
    await pg.queryArray`
      UPDATE familytree.media SET deleted_at = now()
      WHERE id = ${id}::uuid AND tree_id = ${treeId}::uuid AND deleted_at IS NULL
    `;
    await writeLog(pg, {
      treeId,
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "delete",
      targetType: "media",
      targetId: id,
      summary: "Removed " + before.kind + " “" + before.title + "”",
      before,
    });
    await pg.queryArray`COMMIT`;
    return { ok: true };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function linkMedia(
  pg: Client,
  tree: Record<string, unknown>,
  auth: Auth,
  body: Record<string, unknown>,
) {
  const mediaId = requireUuid(body.mediaId, "mediaId");
  const targetType = String(body.targetType || "");
  const targetId = requireUuid(body.targetId, "targetId");
  const treeId = String(tree.id);
  const before = await loadItem(pg, treeId, mediaId);
  await assertTarget(pg, treeId, targetType, targetId);
  const hasRegion = Object.prototype.hasOwnProperty.call(body, "region");
  const existing = before.links.filter((l) => l.targetType === targetType && l.targetId === targetId)[0];
  const region = hasRegion ? parseRegion(body.region) : (existing ? existing.region : null);
  const isPrimary = body.isPrimary === true && targetType === "person"
    ? true
    : body.isPrimary === false
    ? false
    : existing
    ? existing.isPrimary
    : false;
  const actor = actorName(auth);
  await pg.queryArray`BEGIN`;
  try {
    await upsertLink(pg, mediaId, { targetType, targetId, isPrimary, region });
    const after = await loadItem(pg, treeId, mediaId);
    const who = after.people.filter((p) => p.id === targetId)[0];
    const name = who ? (who.givenNames + " " + who.surname).trim() : targetType;
    let summary = "Linked “" + after.title + "” to " + name;
    if (isPrimary && targetType === "person") summary = "Set “" + after.title + "” as the profile photo for " + name;
    else if (region && targetType === "person") summary = "Tagged " + name + " on “" + after.title + "”";
    await writeLog(pg, {
      treeId,
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "update",
      targetType: "media",
      targetId: mediaId,
      summary,
      before,
      after,
    });
    await pg.queryArray`COMMIT`;
    return { media: after };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function unlinkMedia(
  pg: Client,
  tree: Record<string, unknown>,
  auth: Auth,
  body: Record<string, unknown>,
) {
  const mediaId = requireUuid(body.mediaId, "mediaId");
  const targetType = String(body.targetType || "");
  const targetId = requireUuid(body.targetId, "targetId");
  if (!TARGETS.has(targetType)) throw statusErr("targetType is not supported", 400);
  const treeId = String(tree.id);
  const before = await loadItem(pg, treeId, mediaId);
  const actor = actorName(auth);
  await pg.queryArray`BEGIN`;
  try {
    await pg.queryArray`
      DELETE FROM familytree.media_links
      WHERE media_id = ${mediaId}::uuid AND target_type = ${targetType} AND target_id = ${targetId}::uuid
    `;
    if (targetType === "person") {
      await pg.queryArray`
        UPDATE familytree.persons SET profile_media_id = NULL
        WHERE id = ${targetId}::uuid AND profile_media_id = ${mediaId}::uuid
      `;
    }
    const after = await loadItem(pg, treeId, mediaId);
    await writeLog(pg, {
      treeId,
      actorId: String(auth.contributor.id),
      actorName: actor,
      action: "update",
      targetType: "media",
      targetId: mediaId,
      summary: "Unlinked a record from “" + after.title + "”",
      before,
      after,
    });
    await pg.queryArray`COMMIT`;
    return { media: after };
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function listMedia(
  pg: Client,
  tree: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const treeId = String(tree.id);
  const kind = String(body.kind || "");
  if (kind && !KINDS.has(kind)) throw statusErr("Unknown media kind", 400);
  const personId = String(body.personId || "");
  if (personId) requireUuid(personId, "personId");
  const decade = Math.max(0, Math.min(3000, Number(body.decade) || 0));
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));
  const offset = Math.max(0, Number(body.offset) || 0);
  const q = clip(body.q, 80).toLowerCase();
  const like = "%" + q.replace(/[%_\\]/g, "") + "%";
  const personUuid = personId || "00000000-0000-0000-0000-000000000000";
  const decadeFrom = decade > 0 ? decade : 1000;
  const decadeTo = decade > 0 ? decade + 10 : 1010;
  const rows = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.media m
    WHERE m.tree_id = ${treeId}::uuid AND m.deleted_at IS NULL
      AND (${kind} = '' OR m.kind = ${kind})
      AND (
        ${personId} = '' OR EXISTS (
          SELECT 1 FROM familytree.media_links ml
          WHERE ml.media_id = m.id AND ml.target_type = 'person' AND ml.target_id = ${personUuid}::uuid
        )
      )
      AND (
        ${decade}::int = 0 OR (
          m.date_sort >= make_date(${decadeFrom}::int, 1, 1)
          AND m.date_sort < make_date(${decadeTo}::int, 1, 1)
        )
      )
      AND (
        ${q} = '' OR m.title ILIKE ${like}
        OR coalesce(m.caption, '') ILIKE ${like}
        OR coalesce(m.place_text, '') ILIKE ${like}
        OR coalesce(m.date_text, '') ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM familytree.media_links ml
          JOIN familytree.persons p ON p.id = ml.target_id AND p.deleted_at IS NULL
          WHERE ml.media_id = m.id AND ml.target_type = 'person'
            AND (p.given_names || ' ' || p.surname) ILIKE ${like}
        )
      )
    ORDER BY m.date_sort NULLS LAST, m.created_at DESC
  `;
  const total = rows.rows.length;
  const page = rows.rows.slice(offset, offset + limit);
  const links = await linksFor(pg, treeId, page.map((r) => String(r.id)));
  return { media: page.map((row) => shape(row, links)), total };
}

export async function mediaForPerson(pg: Client, tree: Record<string, unknown>, personId: string) {
  if (!personId) return [] as MediaItem[];
  requireUuid(personId, "id");
  const treeId = String(tree.id);
  const rows = await pg.queryObject<Record<string, unknown>>`
    SELECT m.*
    FROM familytree.media m
    WHERE m.tree_id = ${treeId}::uuid AND m.deleted_at IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM familytree.media_links ml
          WHERE ml.media_id = m.id AND ml.target_type = 'person' AND ml.target_id = ${personId}::uuid
        )
        OR EXISTS (
          SELECT 1 FROM familytree.media_links ml
          JOIN familytree.events e ON e.id = ml.target_id AND e.deleted_at IS NULL
          WHERE ml.media_id = m.id AND ml.target_type = 'event' AND e.person_id = ${personId}::uuid
        )
        OR EXISTS (
          SELECT 1 FROM familytree.media_links ml
          JOIN familytree.families f ON f.id = ml.target_id AND f.deleted_at IS NULL
          WHERE ml.media_id = m.id AND ml.target_type = 'family'
            AND (f.partner1_id = ${personId}::uuid OR f.partner2_id = ${personId}::uuid)
        )
      )
    ORDER BY m.date_sort NULLS LAST, m.created_at DESC
  `;
  const links = await linksFor(pg, treeId, rows.rows.map((r) => String(r.id)));
  return rows.rows.map((row) => shape(row, links));
}

export async function storageUsage(
  pg: Client,
  tree: Record<string, unknown>,
  auth: Auth,
) {
  if (auth.contributor.role !== "admin") throw statusErr("Admin only", 403);
  const r = await pg.queryObject<{ n: number; bytes: number }>`
    SELECT count(*)::int AS n, coalesce(sum(byte_size), 0)::bigint AS bytes
    FROM familytree.media
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL
  `;
  const row = r.rows[0];
  return {
    count: Number(row?.n) || 0,
    bytes: Number(row?.bytes) || 0,
    quotaBytes: 1024 * 1024 * 1024,
    note: "This tree's files, measured against the shared 1 GB Apps project quota.",
  };
}
