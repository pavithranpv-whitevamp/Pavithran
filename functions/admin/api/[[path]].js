// Website admin — the back end behind https://pavithran.pages.dev/admin/
// A Cloudflare Pages Function. Every change is saved to the GitHub repo as one commit,
// and Cloudflare then rebuilds the site automatically.
//
// Settings (Cloudflare → Workers & Pages → pavithran → Settings → Variables and Secrets):
//   ADMIN_USER      the username for the admin page
//   ADMIN_PASSWORD  the password for the admin page            (add as "Secret")
//   GITHUB_TOKEN    a fine-grained GitHub token for this repo,
//                   with "Contents: Read and write" permission  (add as "Secret")
// Optional: GITHUB_REPO (default "pavithranpv-whitevamp/Pavithran"), GITHUB_BRANCH (default "main").

const COOKIE = 'pv_admin';
const SESSION_DAYS = 30;
const PROJECTS_DIR = 'content/projects';
const IMAGES_DIR = 'images';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

// ---------- small helpers ----------
const enc = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers },
  });
}
const fail = (status, error) => json({ error }, status);

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

// UTF-8 text -> base64 (GitHub wants file contents in base64)
function textToBase64(text) {
  const bytes = enc.encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function hmacKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`pv-admin|${env.ADMIN_PASSWORD}|${env.GITHUB_TOKEN}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// Compare two strings without leaking where they differ.
async function sameText(a, b) {
  const key = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [x, y] = await Promise.all([crypto.subtle.sign('HMAC', key, enc.encode(String(a))), crypto.subtle.sign('HMAC', key, enc.encode(String(b)))]);
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

async function makeSession(env, user) {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload)));
  return `${payload}.${sig}`;
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

const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

// ---------- GitHub ----------
function gh(env) {
  const repo = env.GITHUB_REPO || 'pavithranpv-whitevamp/Pavithran';
  const branch = env.GITHUB_BRANCH || 'main';
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pavithran-website-admin',
    'Content-Type': 'application/json',
  };
  async function call(method, path, body) {
    const r = await fetch(`https://api.github.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
    if (!r.ok) {
      const err = new Error(`GitHub ${r.status}: ${(data && data.message) || 'error'}`);
      err.status = r.status;
      throw err;
    }
    return data;
  }
  const [owner, name] = repo.split('/');
  return {
    repo, branch, owner, name, call,
    // Read every project file in one request.
    async listProjects() {
      const q = `query($o:String!,$n:String!,$e:String!){repository(owner:$o,name:$n){object(expression:$e){... on Tree{entries{name object{... on Blob{text}}}}}}}`;
      const data = await call('POST', '/graphql', { query: q, variables: { o: owner, n: name, e: `${branch}:${PROJECTS_DIR}` } });
      if (data.errors && data.errors.length) throw new Error('GitHub: ' + data.errors[0].message);
      const entries = (data.data && data.data.repository && data.data.repository.object && data.data.repository.object.entries) || [];
      return entries.filter((e) => e.name.endsWith('.json') && e.object && typeof e.object.text === 'string');
    },
    async createBlob(base64) {
      return (await call('POST', `/repos/${repo}/git/blobs`, { content: base64, encoding: 'base64' })).sha;
    },
    // Apply file changes as a single commit on the branch. changes: [{path, content?|sha?|delete?}]
    async commit(message, changes) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const ref = await call('GET', `/repos/${repo}/git/ref/heads/${branch}`);
        const head = ref.object.sha;
        const baseTree = (await call('GET', `/repos/${repo}/git/commits/${head}`)).tree.sha;
        const tree = changes.map((c) => c.delete
          ? { path: c.path, mode: '100644', type: 'blob', sha: null }
          : c.sha ? { path: c.path, mode: '100644', type: 'blob', sha: c.sha }
            : { path: c.path, mode: '100644', type: 'blob', content: c.content });
        const newTree = await call('POST', `/repos/${repo}/git/trees`, { base_tree: baseTree, tree });
        const commit = await call('POST', `/repos/${repo}/git/commits`, { message, tree: newTree.sha, parents: [head] });
        try {
          await call('PATCH', `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
          return commit.sha;
        } catch (e) {
          if (e.status !== 422 || attempt === 2) throw e; // 422 = someone else saved at the same moment; try again
        }
      }
      return null;
    },
  };
}

// ---------- project data ----------
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_PATH_RE = /^\/images\/[A-Za-z0-9._@-]+\.(?:jpe?g|png|webp|gif)$/i;

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');

const clean = (s, max) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, max);

function normaliseProject(input) {
  const images = (Array.isArray(input.images) ? input.images : []).map((p) => String(p || '').trim()).filter((p) => IMAGE_PATH_RE.test(p)).slice(0, 200);
  const youtube = (Array.isArray(input.youtube) ? input.youtube : [input.youtube]).map((u) => clean(u, 300)).filter((u) => /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)).slice(0, 50);
  let cover = String(input.cover || '').trim();
  if (!IMAGE_PATH_RE.test(cover)) cover = '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? input.date : new Date().toISOString().slice(0, 10);
  return {
    title: clean(input.title, 120),
    category: clean(input.category, 60),
    date,
    show_on_home: input.show_on_home !== false,
    cover,
    description: clean(input.description, 5000),
    youtube,
    images,
  };
}

function parseProjectFile(name, text) {
  let d = {};
  try { d = JSON.parse(text) || {}; } catch { d = { title: name.replace(/\.json$/, ''), _broken: true }; }
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => (x && typeof x === 'object' ? x.image || x.link || x.url || '' : String(x || ''))).filter(Boolean);
  return {
    slug: name.replace(/\.json$/, ''),
    title: d.title || name.replace(/\.json$/, ''),
    category: d.category || '',
    date: d.date || '',
    show_on_home: d.show_on_home !== false,
    cover: d.cover ? '/' + String(d.cover).replace(/^\/+/, '') : '',
    description: d.description || '',
    youtube: asList(d.youtube),
    images: asList(d.images).map((p) => (/^https?:/.test(p) ? p : '/' + p.replace(/^\/+/, ''))),
    broken: !!d._broken,
  };
}

// ---------- routes ----------
async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  const okUser = await sameText(body.username || '', env.ADMIN_USER);
  const okPass = await sameText(body.password || '', env.ADMIN_PASSWORD);
  if (!(okUser && okPass)) {
    await new Promise((r) => setTimeout(r, 1200)); // slow down password guessing
    return fail(401, 'Wrong username or password.');
  }
  const token = await makeSession(env, env.ADMIN_USER);
  return json({ ok: true, user: env.ADMIN_USER }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
}

async function listProjects(env) {
  const files = await gh(env).listProjects();
  const projects = files.map((f) => parseProjectFile(f.name, f.object.text))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
  return json({ projects });
}

async function uploadImage(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.data !== 'string') return fail(400, 'No image received.');
  const ext = String(body.ext || '').toLowerCase().replace(/^\./, '');
  if (!IMAGE_TYPES[ext]) return fail(400, 'Only JPG, PNG, WebP or GIF images can be uploaded.');
  if (body.data.length * 0.75 > MAX_IMAGE_BYTES) return fail(413, 'That image is too large (over 12 MB).');
  if (!/^[A-Za-z0-9+/]+=*$/.test(body.data)) return fail(400, 'The image data is damaged. Please try again.');
  const base = slugify(body.name || 'image').slice(0, 40) || 'image';
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `${IMAGES_DIR}/${base}-${stamp}-${rand}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const sha = await gh(env).createBlob(body.data);
  return json({ path: '/' + path, sha });
}

async function saveProject(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.project) return fail(400, 'Nothing to save.');
  const project = normaliseProject(body.project);
  if (!project.title) return fail(400, 'Please give the project a title.');
  if (!project.images.length && !project.youtube.length) return fail(400, 'Add at least one image or YouTube link.');

  // New images uploaded in this session: [{path: "/images/x.jpg", sha}]
  const uploads = (Array.isArray(body.uploads) ? body.uploads : [])
    .filter((u) => u && IMAGE_PATH_RE.test(u.path) && /^[0-9a-f]{40}$/.test(u.sha) && project.images.concat(project.cover).includes(u.path));

  const api = gh(env);
  const existing = (await api.listProjects()).map((f) => f.name.replace(/\.json$/, ''));
  let slug = body.slug ? String(body.slug) : '';
  const isNew = !slug;
  if (isNew) {
    const base = slugify(project.title) || 'project';
    slug = base;
    for (let n = 2; existing.includes(slug); n++) slug = `${base}-${n}`;
  } else if (!SLUG_RE.test(slug) || !existing.includes(slug)) {
    return fail(404, 'That project no longer exists. Reload the page and try again.');
  }

  const changes = uploads.map((u) => ({ path: u.path.slice(1), sha: u.sha }));
  changes.push({ path: `${PROJECTS_DIR}/${slug}.json`, content: JSON.stringify(project, null, 2) + '\n' });
  await api.commit(`${isNew ? 'Add' : 'Update'} project "${project.title}" (via website admin)`, changes);
  return json({ ok: true, slug, url: `/work/${slug}/` });
}

async function deleteProject(request, env) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || '');
  if (!SLUG_RE.test(slug)) return fail(400, 'Unknown project.');
  const api = gh(env);
  const files = await api.listProjects();
  const file = files.find((f) => f.name === `${slug}.json`);
  if (!file) return fail(404, 'That project was already deleted.');
  const title = parseProjectFile(file.name, file.object.text).title;
  await api.commit(`Delete project "${title}" (via website admin)`, [{ path: `${PROJECTS_DIR}/${slug}.json`, delete: true }]);
  return json({ ok: true });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const route = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/');
  const method = request.method;

  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || !env.GITHUB_TOKEN) {
    return fail(503, 'The admin page is not set up yet: ADMIN_USER, ADMIN_PASSWORD and GITHUB_TOKEN must be added in Cloudflare.');
  }

  // Requests that change something must come from this site (blocks cross-site form tricks).
  if (method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return fail(403, 'Blocked.');
  }

  try {
    if (route === 'login' && method === 'POST') return await login(request, env);
    if (route === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });

    const session = await readSession(env, request);
    if (!session) return fail(401, 'Please log in.');

    if (route === 'me' && method === 'GET') return json({ user: session.u });
    if (route === 'projects' && method === 'GET') return await listProjects(env);
    if (route === 'upload' && method === 'POST') return await uploadImage(request, env);
    if (route === 'save' && method === 'POST') return await saveProject(request, env);
    if (route === 'delete' && method === 'POST') return await deleteProject(request, env);
    return fail(404, 'Not found.');
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/GitHub 401|Bad credentials/i.test(msg)) return fail(502, 'GitHub rejected the access key (GITHUB_TOKEN). It may have expired — create a new one and update it in Cloudflare.');
    if (/GitHub 403|GitHub 404|Resource not accessible/i.test(msg)) return fail(502, 'The GitHub access key cannot write to the Pavithran repo. Check it has "Contents: Read and write" for that repo.');
    return fail(500, 'Something went wrong: ' + msg);
  }
}
