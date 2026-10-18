/**
 * familytree-api — Supabase Edge Function (no JWT).
 *
 * Hashing (keep in sync with docs/runbook.md):
 * - Passwords and the tree admin unlock code: bcrypt (bcryptjs, cost 10).
 * - Invite / reset codes and session tokens: SHA-256 hex of the normalized plaintext.
 * Share codes are stored in plaintext (they are the view secret, like a document link).
 *
 * All SQL uses the postgres client against schema familytree (not PostgREST),
 * so the schema does not need to be in the project's exposed-API list.
 */
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_DAYS = 90;
const BCRYPT_COST = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: unknown, status = 200) {
  return responseJson({ error: null, data }, status);
}

function fail(error: string, status = 400, data: unknown = null) {
  return responseJson({ error, data }, status);
}

function errMsg(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const o = e as { message?: string; error?: string };
  if (o.message) return o.message;
  if (o.error) return o.error;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function randomCode(len = 6) {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normHandle(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value: string) {
  const s = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "family";
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hashPassword(password: string) {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

function checkPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    if (text.startsWith("data=")) {
      const params = new URLSearchParams(text);
      return JSON.parse(params.get("data") || "{}");
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function pgConnect() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL") || "";
  if (!dbUrl) throw new Error("Missing SUPABASE_DB_URL");
  const client = new Client(dbUrl);
  await client.connect();
  return client;
}

type RateBucket = { n: number; reset: number };
const rateBuckets = new Map<string, RateBucket>();

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

function rateOk(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || now > b.reset) {
    rateBuckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= max) return false;
  b.n += 1;
  return true;
}

function publicContributor(row: Record<string, unknown>) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    role: row.role,
    selfPersonId: row.self_person_id ?? null,
  };
}

function statusErr(message: string, status: number) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

async function findTree(pg: Client, treeCode: unknown) {
  const code = normCode(treeCode);
  if (!code) return null;
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.trees WHERE share_code = ${code} LIMIT 1
  `;
  return r.rows[0] || null;
}

async function requireTree(pg: Client, treeCode: unknown) {
  const tree = await findTree(pg, treeCode);
  if (!tree) throw statusErr("Unknown or invalid share code", 403);
  return tree;
}

async function issueSession(pg: Client, contributorId: string) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const days = String(SESSION_DAYS);
  await pg.queryArray`
    INSERT INTO familytree.sessions (contributor_id, token_hash, expires_at, last_seen_at)
    VALUES (
      ${contributorId}::uuid,
      ${tokenHash},
      now() + (${days} || ' days')::interval,
      now()
    )
  `;
  await pg.queryArray`
    UPDATE familytree.contributors SET last_seen_at = now() WHERE id = ${contributorId}::uuid
  `;
  return token;
}

type SessionAuth = {
  session: Record<string, unknown>;
  contributor: Record<string, unknown>;
};

async function loadSession(
  pg: Client,
  sessionToken: unknown,
  treeId?: string,
): Promise<SessionAuth | null> {
  const token = String(sessionToken || "").trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const sess = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.sessions
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    LIMIT 1
  `;
  const session = sess.rows[0];
  if (!session) return null;
  if (new Date(String(session.expires_at)).getTime() < Date.now()) return null;
  const contrib = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.contributors WHERE id = ${session.contributor_id}::uuid LIMIT 1
  `;
  const contributor = contrib.rows[0];
  if (!contributor || contributor.disabled_at) return null;
  if (treeId && String(contributor.tree_id) !== treeId) return null;
  const days = String(SESSION_DAYS);
  await pg.queryArray`
    UPDATE familytree.sessions
    SET last_seen_at = now(),
        expires_at = now() + (${days} || ' days')::interval
    WHERE id = ${session.id}::uuid
  `;
  await pg.queryArray`
    UPDATE familytree.contributors SET last_seen_at = now() WHERE id = ${contributor.id}::uuid
  `;
  return { session, contributor };
}

async function requireSession(pg: Client, sessionToken: unknown, treeId?: string) {
  const auth = await loadSession(pg, sessionToken, treeId);
  if (!auth) throw statusErr("Not signed in", 403);
  return auth;
}

function validateHandle(handle: string) {
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(handle)) {
    return "Handle must start with a letter and be 3–32 characters (letters, numbers, . _ -)";
  }
  return null;
}

function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 200) return "Password is too long";
  return null;
}

async function statusAction(pg: Client) {
  const r = await pg.queryObject<{ n: number }>`SELECT count(*)::int AS n FROM familytree.trees`;
  return ok({ hasTrees: (r.rows[0]?.n || 0) > 0 });
}

async function lookupTree(pg: Client, body: Record<string, unknown>) {
  const tree = await findTree(pg, body.treeCode);
  if (!tree) return fail("Unknown or invalid share code", 404);
  const c = await pg.queryObject<{ n: number }>`
    SELECT count(*)::int AS n FROM familytree.persons
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL
  `;
  const settings = (tree.settings || {}) as Record<string, unknown>;
  return ok({
    id: tree.id,
    name: tree.name,
    slug: tree.slug,
    personCount: c.rows[0]?.n || 0,
    settings: { homePersonId: settings.homePersonId ?? null },
  });
}

async function bootstrapTree(pg: Client, req: Request, body: Record<string, unknown>) {
  if (!rateOk("bootstrap:" + clientIp(req), 3, 15 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const name = String(body.name || "Family tree").trim() || "Family tree";
  if (name.length > 80) return fail("Tree name is too long");
  let slug = slugify(String(body.slug || name));
  await pg.queryArray`BEGIN`;
  try {
    const existing = await pg.queryObject<{ n: number }>`
      SELECT count(*)::int AS n FROM familytree.trees
    `;
    if ((existing.rows[0]?.n || 0) > 0) {
      await pg.queryArray`ROLLBACK`;
      return fail("A tree already exists", 403);
    }
    const shareCode = randomCode(6);
    const adminCode = randomCode(8);
    const inviteCode = randomCode(8);
    const adminHash = hashPassword(adminCode);
    const inviteHash = await sha256Hex(inviteCode);
    for (let i = 0; i < 5; i++) {
      const clash = await pg.queryObject<{ id: string }>`
        SELECT id FROM familytree.trees WHERE slug = ${slug} LIMIT 1
      `;
      if (!clash.rows.length) break;
      slug = slugify(name) + "-" + randomCode(3).toLowerCase();
    }
    const treeIns = await pg.queryObject<{ id: string }>`
      INSERT INTO familytree.trees (name, slug, share_code, admin_code_hash)
      VALUES (${name}, ${slug}, ${shareCode}, ${adminHash})
      RETURNING id
    `;
    const treeId = treeIns.rows[0].id;
    await pg.queryArray`
      INSERT INTO familytree.invites (tree_id, purpose, code_hash, label, expires_at)
      VALUES (
        ${treeId}::uuid, 'register', ${inviteHash}, 'bootstrap first admin',
        now() + interval '30 days'
      )
    `;
    await pg.queryArray`COMMIT`;
    return ok({
      tree: { id: treeId, name, slug },
      shareCode,
      adminCode,
      inviteCode,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function register(pg: Client, req: Request, body: Record<string, unknown>) {
  if (!rateOk("register:" + clientIp(req), 10, 15 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const tree = await requireTree(pg, body.treeCode);
  const inviteCode = normCode(body.inviteCode);
  const handle = normHandle(body.handle);
  const displayName = String(body.displayName || "").trim();
  const password = String(body.password || "");
  if (!inviteCode) return fail("Invite code is required");
  const handleErr = validateHandle(handle);
  if (handleErr) return fail(handleErr);
  if (!rateOk("register-h:" + String(tree.id) + ":" + handle, 8, 15 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  if (!displayName) return fail("Display name is required");
  if (displayName.length > 80) return fail("Display name is too long");
  const passErr = validatePassword(password);
  if (passErr) return fail(passErr);

  const inviteHash = await sha256Hex(inviteCode);
  const passwordHash = hashPassword(password);
  await pg.queryArray`BEGIN`;
  try {
    const inv = await pg.queryObject<Record<string, unknown>>`
      SELECT * FROM familytree.invites
      WHERE tree_id = ${tree.id}::uuid
        AND code_hash = ${inviteHash}
        AND purpose = 'register'
        AND used_at IS NULL
        AND expires_at > now()
      FOR UPDATE
    `;
    const invite = inv.rows[0];
    if (!invite) {
      await pg.queryArray`ROLLBACK`;
      return fail("Invite is invalid, used, or expired", 403);
    }
    const existing = await pg.queryObject<{ id: string }>`
      SELECT id FROM familytree.contributors
      WHERE tree_id = ${tree.id}::uuid AND handle = ${handle}
      LIMIT 1
    `;
    if (existing.rows.length) {
      await pg.queryArray`ROLLBACK`;
      return fail("That handle is already taken on this tree");
    }
    const count = await pg.queryObject<{ n: number }>`
      SELECT count(*)::int AS n FROM familytree.contributors
      WHERE tree_id = ${tree.id}::uuid
    `;
    const role = (count.rows[0]?.n || 0) === 0 ? "admin" : "contributor";
    const created = await pg.queryObject<Record<string, unknown>>`
      INSERT INTO familytree.contributors
        (tree_id, handle, display_name, password_hash, role, invite_id)
      VALUES (
        ${tree.id}::uuid, ${handle}, ${displayName}, ${passwordHash}, ${role}, ${invite.id}::uuid
      )
      RETURNING *
    `;
    const contributor = created.rows[0];
    await pg.queryArray`
      UPDATE familytree.invites
      SET used_at = now(), contributor_id = ${contributor.id}::uuid
      WHERE id = ${invite.id}::uuid AND used_at IS NULL
    `;
    const sessionToken = await issueSession(pg, String(contributor.id));
    await pg.queryArray`COMMIT`;
    return ok({ sessionToken, contributor: publicContributor(contributor) });
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function connect(pg: Client, req: Request, body: Record<string, unknown>) {
  if (!rateOk("connect:" + clientIp(req), 10, 15 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const tree = await requireTree(pg, body.treeCode);
  const handle = normHandle(body.handle);
  const password = String(body.password || "");
  if (!handle || !password) return fail("Handle and password are required");
  if (!rateOk("connect-h:" + String(tree.id) + ":" + handle, 8, 15 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.contributors
    WHERE tree_id = ${tree.id}::uuid AND handle = ${handle}
    LIMIT 1
  `;
  const contributor = r.rows[0];
  if (!contributor || !checkPassword(password, String(contributor.password_hash))) {
    return fail("Handle or password is wrong", 403);
  }
  if (contributor.disabled_at) return fail("This contributor has been disabled", 403);
  const sessionToken = await issueSession(pg, String(contributor.id));
  return ok({ sessionToken, contributor: publicContributor(contributor) });
}

async function resetPassword(pg: Client, req: Request, body: Record<string, unknown>) {
  if (!rateOk("reset:" + clientIp(req), 10, 15 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const tree = await requireTree(pg, body.treeCode);
  const handle = normHandle(body.handle);
  const resetCode = normCode(body.resetCode);
  const newPassword = String(body.newPassword || "");
  if (!handle || !resetCode) return fail("Handle and reset code are required");
  const passErr = validatePassword(newPassword);
  if (passErr) return fail(passErr);
  const c = await pg.queryObject<Record<string, unknown>>`
    SELECT * FROM familytree.contributors
    WHERE tree_id = ${tree.id}::uuid AND handle = ${handle}
    LIMIT 1
  `;
  const contributor = c.rows[0];
  if (!contributor) return fail("Handle or reset code is wrong", 403);
  if (contributor.disabled_at) return fail("This contributor has been disabled", 403);
  const resetHash = await sha256Hex(resetCode);
  const passwordHash = hashPassword(newPassword);
  await pg.queryArray`BEGIN`;
  try {
    const inv = await pg.queryObject<Record<string, unknown>>`
      SELECT * FROM familytree.invites
      WHERE tree_id = ${tree.id}::uuid
        AND contributor_id = ${contributor.id}::uuid
        AND code_hash = ${resetHash}
        AND purpose = 'reset'
        AND used_at IS NULL
        AND expires_at > now()
      FOR UPDATE
    `;
    if (!inv.rows[0]) {
      await pg.queryArray`ROLLBACK`;
      return fail("Handle or reset code is wrong", 403);
    }
    await pg.queryArray`
      UPDATE familytree.contributors SET password_hash = ${passwordHash}
      WHERE id = ${contributor.id}::uuid
    `;
    await pg.queryArray`
      UPDATE familytree.invites SET used_at = now()
      WHERE id = ${inv.rows[0].id}::uuid AND used_at IS NULL
    `;
    await pg.queryArray`
      UPDATE familytree.sessions SET revoked_at = now()
      WHERE contributor_id = ${contributor.id}::uuid AND revoked_at IS NULL
    `;
    await pg.queryArray`COMMIT`;
    return ok({ ok: true });
  } catch (e) {
    try {
      await pg.queryArray`ROLLBACK`;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function signOut(pg: Client, body: Record<string, unknown>) {
  const token = String(body.sessionToken || "").trim();
  if (!token) return fail("Missing session");
  const tokenHash = await sha256Hex(token);
  await pg.queryArray`
    UPDATE familytree.sessions SET revoked_at = now()
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
  `;
  return ok({ ok: true });
}

async function whoAmI(pg: Client, body: Record<string, unknown>) {
  const tree = await requireTree(pg, body.treeCode);
  const auth = await requireSession(pg, body.sessionToken, String(tree.id));
  return ok(publicContributor(auth.contributor));
}

async function unlockAdmin(pg: Client, body: Record<string, unknown>) {
  const tree = await requireTree(pg, body.treeCode);
  const auth = await requireSession(pg, body.sessionToken, String(tree.id));
  if (auth.contributor.role === "admin") return ok({ ok: true, role: "admin" });
  const adminCode = normCode(body.adminCode);
  if (!adminCode) return fail("Admin code is required");
  if (!checkPassword(adminCode, String(tree.admin_code_hash))) {
    return fail("Admin code is wrong", 403);
  }
  await pg.queryArray`
    UPDATE familytree.contributors SET role = 'admin' WHERE id = ${auth.contributor.id}::uuid
  `;
  return ok({ ok: true, role: "admin" });
}

async function issueInvite(pg: Client, body: Record<string, unknown>) {
  const tree = await requireTree(pg, body.treeCode);
  const auth = await requireSession(pg, body.sessionToken, String(tree.id));
  if (auth.contributor.role !== "admin") return fail("Admin only", 403);
  const purpose = String(body.purpose || "register");
  if (purpose !== "register" && purpose !== "reset") return fail("purpose must be register or reset");
  const label = String(body.label || "").trim() || null;
  const contributorId = body.contributorId ? String(body.contributorId) : null;
  if (purpose === "reset" && !contributorId) return fail("contributorId is required for a reset code");
  const code = randomCode(8);
  const codeHash = await sha256Hex(code);
  const hours = purpose === "reset" ? 24 : 30 * 24;
  const ins = await pg.queryObject<Record<string, unknown>>`
    INSERT INTO familytree.invites
      (tree_id, purpose, code_hash, label, contributor_id, created_by, expires_at)
    VALUES (
      ${tree.id}::uuid,
      ${purpose},
      ${codeHash},
      ${label},
      ${contributorId}::uuid,
      ${auth.contributor.id}::uuid,
      now() + (${String(hours)} || ' hours')::interval
    )
    RETURNING id, purpose, label, expires_at
  `;
  const data = ins.rows[0];
  return ok({ code, expiresAt: data.expires_at, invite: data });
}

async function listInvites(pg: Client, body: Record<string, unknown>) {
  const tree = await requireTree(pg, body.treeCode);
  const auth = await requireSession(pg, body.sessionToken, String(tree.id));
  if (auth.contributor.role !== "admin") return fail("Admin only", 403);
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT id, purpose, label, expires_at, used_at, created_at, contributor_id
    FROM familytree.invites
    WHERE tree_id = ${tree.id}::uuid AND used_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
  `;
  return ok({ invites: r.rows });
}

async function stats(pg: Client, body: Record<string, unknown>) {
  const tree = await requireTree(pg, body.treeCode);
  const persons = await pg.queryObject<{
    n: number;
    living: number;
  }>`
    SELECT
      count(*)::int AS n,
      count(*) FILTER (
        WHERE coalesce(is_living, death_year IS NULL)
      )::int AS living
    FROM familytree.persons
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL
  `;
  const fam = await pg.queryObject<{ n: number }>`
    SELECT count(*)::int AS n FROM familytree.families
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL
  `;
  const media = await pg.queryObject<{ n: number }>`
    SELECT count(*)::int AS n FROM familytree.media
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL
  `;
  const surnames = await pg.queryObject<{ surname: string; count: number }>`
    SELECT surname, count(*)::int AS count
    FROM familytree.persons
    WHERE tree_id = ${tree.id}::uuid AND deleted_at IS NULL AND surname <> ''
    GROUP BY surname
    ORDER BY count DESC, surname
  `;
  return ok({
    persons: persons.rows[0]?.n || 0,
    living: persons.rows[0]?.living || 0,
    families: fam.rows[0]?.n || 0,
    media: media.rows[0]?.n || 0,
    surnames: surnames.rows,
  });
}

async function recentChanges(pg: Client, body: Record<string, unknown>) {
  const tree = await requireTree(pg, body.treeCode);
  const limit = Math.min(50, Math.max(1, Number(body.limit) || 10));
  const r = await pg.queryObject<Record<string, unknown>>`
    SELECT id, actor_id, actor_name, action, target_type, target_id, summary, created_at
    FROM familytree.change_log
    WHERE tree_id = ${tree.id}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  const changes = r.rows.map((c) => ({
    id: c.id,
    actorId: c.actor_id,
    actorName: c.actor_name,
    action: c.action,
    targetType: c.target_type,
    targetId: c.target_id,
    summary: c.summary,
    createdAt: c.created_at,
  }));
  return ok({ changes });
}

function statusOf(e: unknown) {
  const s = (e as { status?: number }).status;
  return typeof s === "number" ? s : 500;
}

async function handle(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  let action = url.searchParams.get("action") || "";
  let body: Record<string, unknown> = {};
  if (req.method === "GET") {
    body = Object.fromEntries(url.searchParams.entries());
  } else if (req.method === "POST") {
    body = await readJsonBody(req);
    action = String(body.action || action || "");
  } else {
    return fail("Method not allowed", 405);
  }

  let pg: Client | null = null;
  try {
    pg = await pgConnect();
    switch (action) {
      case "status":
        return await statusAction(pg);
      case "lookupTree":
        return await lookupTree(pg, body);
      case "bootstrapTree":
        return await bootstrapTree(pg, req, body);
      case "register":
        return await register(pg, req, body);
      case "connect":
        return await connect(pg, req, body);
      case "resetPassword":
        return await resetPassword(pg, req, body);
      case "signOut":
        return await signOut(pg, body);
      case "whoAmI":
        return await whoAmI(pg, body);
      case "unlockAdmin":
        return await unlockAdmin(pg, body);
      case "issueInvite":
        return await issueInvite(pg, body);
      case "listInvites":
        return await listInvites(pg, body);
      case "stats":
        return await stats(pg, body);
      case "recentChanges":
        return await recentChanges(pg, body);
      default:
        return fail("Unknown action: " + action);
    }
  } catch (e) {
    const msg = errMsg(e);
    const status = statusOf(e);
    if (status === 403 || status === 404) return fail(msg, status);
    return fail(msg, 500);
  } finally {
    if (pg) {
      try {
        await pg.end();
      } catch {
        /* ignore */
      }
    }
  }
}

Deno.serve(handle);
