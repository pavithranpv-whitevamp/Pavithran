// Private Vault — the back end behind https://pavithran.pages.dev/admin/vault/
// A Cloudflare Pages Function. Stores your private files (scripts, plugins, …) in a
// Cloudflare KV namespace — NOT in the GitHub repo, which is public.
//
// Login is the same as the website admin (ADMIN_USER / ADMIN_PASSWORD): logging in on
// /admin/ or /admin/vault/ unlocks both.
//
// Setup (once): Cloudflare → Workers & Pages → pavithran → Settings → Bindings →
//   Add → KV namespace → Variable name: VAULT → pick/create a namespace (e.g. "pavithran-vault").
// Then redeploy.

const COOKIE = 'pv_admin';
const CHUNK_BYTES = 20 * 1024 * 1024;     // one KV value can hold up to 25 MB, so big files are split into 20 MB pieces
const MAX_FILE_BYTES = 500 * 1024 * 1024; // largest single file (the free KV plan holds about 1 GB in total)
const KEY_PREFIX = 'f:'; // f:<id>   → the file (small files) or just its details (big files)
const CHUNK_PREFIX = 'c:'; // c:<id>:<n> → piece n of a big file
const enc = new TextEncoder();

// ---------- helpers ----------
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers },
  });
}
const fail = (status, error) => json({ error }, status);
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

// Must match functions/admin/api/[[path]].js so the admin login unlocks the vault too.
async function hmacKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`pv-admin|${env.ADMIN_PASSWORD}|${env.GITHUB_TOKEN}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function readSession(env, request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  try {
    const sigBytes = Uint8Array.from(fromB64url(sig), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), sigBytes, enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(fromB64url(payload), (c) => c.charCodeAt(0))));
    return data.exp > Date.now() && data.u === env.ADMIN_USER ? data : null;
  } catch { return null; }
}

const cleanName = (s) => String(s || '').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f"]/g, '').trim().slice(0, 150);
// Folder like "Scripts" or "Plugins/WordPress". "" = no folder.
function cleanFolder(s) {
  const parts = String(s || '').split('/').map((p) => p.replace(/[\x00-\x1f\x7f\\"]/g, '').trim()).filter(Boolean);
  if (parts.some((p) => p === '.' || p === '..')) return null;
  return parts.map((p) => p.slice(0, 40)).slice(0, 4).join('/');
}
const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Date.now().toString(36) + '-' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const ID_RE = /^[a-z0-9]+-[0-9a-f]{24}$/;

// ---------- routes ----------
async function listFiles(env) {
  const files = [];
  let cursor;
  do {
    const r = await env.VAULT.list({ prefix: KEY_PREFIX, cursor, limit: 1000 });
    for (const k of r.keys) if (k.metadata) files.push({ id: k.name.slice(KEY_PREFIX.length), ...k.metadata });
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  files.sort((a, b) => (b.uploaded || 0) - (a.uploaded || 0));
  return json({ files, maxBytes: MAX_FILE_BYTES, chunkBytes: CHUNK_BYTES });
}

async function upload(request, env) {
  const form = await request.formData().catch(() => null);
  if (!form) return fail(400, 'No file received.');
  const file = form.get('file');
  if (!file || typeof file === 'string') return fail(400, 'No file received.');
  if (file.size > CHUNK_BYTES) return fail(413, 'Big files must be uploaded in pieces. Reload the page and try again.');
  const name = cleanName(file.name);
  if (!name) return fail(400, 'That file has no name.');
  const folder = cleanFolder(form.get('folder'));
  if (folder === null) return fail(400, 'Folder name not allowed.');
  const meta = { name, folder, size: file.size, type: String(file.type || '').slice(0, 100), uploaded: Date.now() };
  const id = newId();
  await env.VAULT.put(KEY_PREFIX + id, await file.arrayBuffer(), { metadata: meta });
  return json({ ok: true, file: { id, ...meta } });
}

// ----- big files: start → pieces → finish -----
function chunkCount(size) { return Math.max(1, Math.ceil(size / CHUNK_BYTES)); }

async function bigStart(request, env) {
  const body = await request.json().catch(() => ({}));
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return fail(400, 'Unknown file size.');
  if (size > MAX_FILE_BYTES) return fail(413, `“${cleanName(body.name)}” is over 500 MB, the vault’s per-file limit.`);
  if (!cleanName(body.name)) return fail(400, 'That file has no name.');
  if (cleanFolder(body.folder) === null) return fail(400, 'Folder name not allowed.');
  return json({ id: newId(), chunks: chunkCount(size), chunkBytes: CHUNK_BYTES });
}

async function bigChunk(request, env, id, nStr) {
  const n = Number(nStr);
  if (!ID_RE.test(id) || !Number.isInteger(n) || n < 0 || n >= chunkCount(MAX_FILE_BYTES)) return fail(400, 'Bad piece.');
  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > CHUNK_BYTES) return fail(413, 'Piece too large.');
  await env.VAULT.put(`${CHUNK_PREFIX}${id}:${n}`, data, { metadata: { t: Date.now() } });
  return json({ ok: true });
}

async function bigFinish(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const size = Number(body.size);
  const name = cleanName(body.name);
  const folder = cleanFolder(body.folder);
  if (!ID_RE.test(id) || !name || folder === null || !(size > 0) || size > MAX_FILE_BYTES) return fail(400, 'Upload details are wrong.');
  const chunks = chunkCount(size);
  // Make sure the last piece arrived before the file appears in the vault.
  const last = await env.VAULT.get(`${CHUNK_PREFIX}${id}:${chunks - 1}`, { type: 'stream' });
  if (!last) return fail(409, 'Some pieces of the file are missing. Please upload it again.');
  await last.cancel();
  const meta = { name, folder, size, type: String(body.type || '').slice(0, 100), uploaded: Date.now(), chunks };
  await env.VAULT.put(KEY_PREFIX + id, '', { metadata: meta });
  return json({ ok: true, file: { id, ...meta } });
}

async function deletePieces(env, id, chunks) {
  const keys = [];
  for (let n = 0; n < (chunks || chunkCount(MAX_FILE_BYTES)); n++) keys.push(`${CHUNK_PREFIX}${id}:${n}`);
  for (let i = 0; i < keys.length; i += 20) await Promise.all(keys.slice(i, i + 20).map((k) => env.VAULT.delete(k)));
}

async function bigAbort(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!ID_RE.test(id)) return fail(400, 'Unknown upload.');
  const done = await env.VAULT.getWithMetadata(KEY_PREFIX + id, { type: 'stream' });
  if (done.value) { await done.value.cancel(); return fail(409, 'That upload already finished.'); }
  await deletePieces(env, id, Math.max(1, Math.min(chunkCount(MAX_FILE_BYTES), Number(body.chunks) || 0)));
  return json({ ok: true });
}

async function download(env, id) {
  if (!ID_RE.test(id)) return fail(400, 'Unknown file.');
  const { value, metadata } = await env.VAULT.getWithMetadata(KEY_PREFIX + id, { type: 'stream' });
  if (!value) return fail(404, 'That file no longer exists.');
  const name = (metadata && metadata.name) || 'file';
  let body = value;
  if (metadata && metadata.chunks) {
    await value.cancel();
    // Join the pieces back together as the download streams out.
    const { readable, writable } = new TransformStream();
    (async () => {
      try {
        for (let n = 0; n < metadata.chunks; n++) {
          const part = await env.VAULT.get(`${CHUNK_PREFIX}${id}:${n}`, { type: 'stream' });
          if (!part) throw new Error('missing piece ' + n);
          await part.pipeTo(writable, { preventClose: true });
        }
        await writable.close();
      } catch (e) { await writable.abort(e).catch(() => {}); }
    })();
    body = readable;
  }
  return new Response(body, {
    headers: {
      ...(metadata && metadata.size ? { 'Content-Length': String(metadata.size) } : {}),
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

async function update(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!ID_RE.test(id)) return fail(400, 'Unknown file.');
  const { value, metadata } = await env.VAULT.getWithMetadata(KEY_PREFIX + id, { type: 'arrayBuffer' });
  if (value === null || !metadata) return fail(404, 'That file no longer exists.');
  const meta = { ...metadata };
  if (body.name !== undefined) {
    const n = cleanName(body.name);
    if (!n) return fail(400, 'Please give the file a name.');
    meta.name = n;
  }
  if (body.folder !== undefined) {
    const f = cleanFolder(body.folder);
    if (f === null) return fail(400, 'Folder name not allowed.');
    meta.folder = f;
  }
  await env.VAULT.put(KEY_PREFIX + id, value, { metadata: meta });
  return json({ ok: true, file: { id, ...meta } });
}

async function remove(request, env) {
  const body = await request.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(String).filter((i) => ID_RE.test(i)).slice(0, 100);
  if (!ids.length) return fail(400, 'Nothing to delete.');
  for (const i of ids) {
    const { metadata } = await env.VAULT.getWithMetadata(KEY_PREFIX + i, { type: 'stream' }).then((r) => { if (r.value) r.value.cancel(); return r; });
    if (metadata && metadata.chunks) await deletePieces(env, i, metadata.chunks);
    await env.VAULT.delete(KEY_PREFIX + i);
  }
  return json({ ok: true, deleted: ids.length });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean);
  const route = parts[0] || '';
  const method = request.method;

  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return fail(503, 'Admin login is not set up (ADMIN_USER / ADMIN_PASSWORD).');
  if (!env.VAULT) return fail(503, 'The vault storage is not connected yet. In Cloudflare → pavithran → Settings → Bindings, add a KV namespace named VAULT, then redeploy.');

  if (method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(request.url).origin) return fail(403, 'Blocked.');
  }

  const session = await readSession(env, request);
  if (!session) return fail(401, 'Please log in.');

  try {
    if (route === 'me' && method === 'GET') return json({ user: session.u });
    if (route === 'list' && method === 'GET') return await listFiles(env);
    if (route === 'file' && method === 'GET' && parts.length === 2) return await download(env, parts[1]);
    if (route === 'upload' && method === 'POST') return await upload(request, env);
    if (route === 'big-start' && method === 'POST') return await bigStart(request, env);
    if (route === 'big-chunk' && method === 'POST' && parts.length === 3) return await bigChunk(request, env, parts[1], parts[2]);
    if (route === 'big-finish' && method === 'POST') return await bigFinish(request, env);
    if (route === 'big-abort' && method === 'POST') return await bigAbort(request, env);
    if (route === 'update' && method === 'POST') return await update(request, env);
    if (route === 'delete' && method === 'POST') return await remove(request, env);
    return fail(404, 'Not found.');
  } catch (e) {
    return fail(500, 'Something went wrong: ' + String((e && e.message) || e));
  }
}
