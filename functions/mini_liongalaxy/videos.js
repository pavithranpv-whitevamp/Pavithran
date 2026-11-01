// Mini Lion Galaxy — YouTube autopilot feed (Cloudflare Pages Function).
// Served at /mini_liongalaxy/videos. Replaces the old videos.php.
//
// Returns the channel's latest videos as JSON for the Explore page, so new uploads
// appear on the site by themselves. No API key needed.
//   1. Tries YouTube's RSS feed (has dates and view counts).
//   2. If that fails, reads the channel's Videos and Shorts tabs and gets titles from oEmbed.
//   3. Results are cached for 15 minutes; if YouTube can't be reached, the last good copy is served.

const CHANNEL_ID = 'UC68V0u0qcaH_9tuQJs2MBhQ';
const HANDLE = 'miniliongalaxy';
const TTL = 15 * 60;          // seconds a fresh copy is used
const KEEP = 7 * 24 * 3600;   // seconds a stale copy is kept as a fallback
const MAX = 60;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, '&');

async function get(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' },
    cf: { cacheTtl: 0 },
  });
  return r.ok ? r.text() : null;
}

export function parseRss(xml) {
  const videos = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    videos.push({
      id,
      title: decode((e.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1].trim()),
      published: (e.match(/<published>([^<]+)<\/published>/) || [, ''])[1],
      views: parseInt((e.match(/<media:statistics[^>]*views="(\d+)"/) || [, '0'])[1], 10) || 0,
    });
  }
  return videos;
}

async function fromRss() {
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
  if (!xml) return null;
  const v = parseRss(xml);
  return v.length ? v : null;
}

async function fromChannelPage(knownTitles) {
  const ids = new Set();
  let reached = false;
  for (const tab of ['videos', 'shorts']) {
    const html = await get(`https://www.youtube.com/@${HANDLE}/${tab}`).catch(() => null);
    if (!html || !html.includes(CHANNEL_ID)) continue; // only trust this channel's own page
    reached = true;
    for (const m of html.matchAll(/"(?:videoId|contentId)":"([\w-]{11})"/g)) ids.add(m[1]);
  }
  if (!reached) return null;
  const list = [...ids].slice(0, MAX);
  const out = await Promise.all(list.map(async (id) => {
    if (knownTitles[id]) return { id, title: knownTitles[id], published: '', views: 0 };
    const o = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)
      .then((t) => (t ? JSON.parse(t) : null)).catch(() => null);
    if (!o || !o.title) return null; // private, deleted or not from this channel
    if (o.author_url && !o.author_url.toLowerCase().includes(HANDLE) && !o.author_url.includes(CHANNEL_ID)) return null;
    return { id, title: o.title, published: '', views: 0 };
  }));
  return out.filter(Boolean);
}

const json = (body, status = 200) => new Response(body, {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'public, max-age=300',
    'X-Robots-Tag': 'noindex',
    'Access-Control-Allow-Origin': '*',
  },
});

export async function onRequestGet(context) {
  const cache = caches.default;
  const key = new Request(new URL('/mini_liongalaxy/__videos_cache', context.request.url).toString());
  const cached = await cache.match(key);
  let cachedBody = cached ? await cached.text() : '';
  let cachedData = null;
  try { cachedData = cachedBody ? JSON.parse(cachedBody) : null; } catch { cachedBody = ''; }

  const age = cachedData ? (Date.now() - Date.parse(cachedData.updated || 0)) / 1000 : Infinity;
  if (cachedBody && age < TTL) return json(cachedBody);

  const known = {};
  for (const v of (cachedData && cachedData.videos) || []) known[v.id] = v.title;

  let source = 'rss';
  let videos = await fromRss().catch(() => null);
  if (!videos) {
    source = 'channel';
    videos = await fromChannelPage(known).catch(() => null);
  }

  if (videos && videos.length) {
    const body = JSON.stringify({ channel: CHANNEL_ID, source, updated: new Date().toISOString(), videos: videos.slice(0, MAX) });
    context.waitUntil(cache.put(key, new Response(body, { headers: { 'Cache-Control': `public, max-age=${KEEP}` } })));
    return json(body);
  }
  if (cachedBody) return json(cachedBody); // YouTube unreachable right now: last good copy
  return json('{"videos":[],"error":"feed_unavailable"}', 502);
}
