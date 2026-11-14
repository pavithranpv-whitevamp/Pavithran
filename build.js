// Builds the website into dist/ from:
//   src/               page templates, styles and scripts
//   images/            every image (the dashboard uploads here)
//   content/projects/  one .json file per project (the dashboard writes these)
// Cloudflare Pages runs this on every change:  build command "node build.js", output "dist".

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const PROJECTS = path.join(ROOT, 'content', 'projects');
const TESTIMONIALS = path.join(ROOT, 'content', 'testimonials.json');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) => String(s).toLowerCase()
  .replace(/\.json$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';

// Images can be saved as "/images/a.jpg", "images/a.jpg" or {image: "..."}; make them all "/images/a.jpg".
const imgPath = (v) => {
  if (v && typeof v === 'object') v = v.image || v.src || v.path || '';
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v)) return v;
  return '/' + v.replace(/^\/+/, '');
};
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(imgPath).filter(Boolean);

// Pull the video id out of any YouTube link (watch, youtu.be, shorts, embed).
const youtubeId = (url) => {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : '';
};

const paragraphs = (text) => String(text || '').split(/\n\s*\n/)
  .map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}

// ---------- read projects ----------
const problems = [];
const projects = (fs.existsSync(PROJECTS) ? fs.readdirSync(PROJECTS) : [])
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(PROJECTS, f), 'utf8')); }
    catch (e) { problems.push(`${f}: not valid JSON (${e.message}) - skipped`); return null; }
    if (!d || d.draft === true) return null;
    // "hidden": uploads switched off in the admin - kept in the file, left off the website
    const hiddenRaw = (Array.isArray(d.hidden) ? d.hidden : []).map((h) => String(h || '').trim()).filter(Boolean);
    const hidden = new Set([...hiddenRaw, ...hiddenRaw.map(imgPath), ...hiddenRaw.map((h) => youtubeId(h)).filter(Boolean)]);
    const images = asList(d.images).filter((src) => !hidden.has(src));
    // "youtube" can be one link or a list of links
    const links = (Array.isArray(d.youtube) ? d.youtube : [d.youtube])
      .map((v) => String(v && typeof v === 'object' ? (v.link || v.url || '') : (v || '')))
      .filter((l) => !hidden.has(l.trim()) && !hidden.has(youtubeId(l)));
    const vids = [];
    for (const l of links) {
      const id = youtubeId(l);
      if (!id) continue;
      if (vids.some((v) => v.id === id)) { problems.push(`${f}: the same YouTube video is listed twice (${id}) - shown once`); continue; }
      vids.push({ id, short: /\/shorts\//i.test(l) });
    }
    const yts = vids.map((v) => v.id);
    // Unsolicited Redesign: "before" is a photo of someone else's original design. It is shown only
    // next to the redesign (never as Pavithran's own work), and the rest of the photos are the "after".
    const redesign = d.redesign === true;
    const before = redesign && images.includes(imgPath(d.before)) ? imgPath(d.before) : '';
    const own = images.filter((src) => src !== before);
    const pickedCover = hidden.has(imgPath(d.cover)) ? '' : imgPath(d.cover);
    const cover = (pickedCover && pickedCover !== before ? pickedCover : '') || own[0] || (yts[0] ? `https://i.ytimg.com/vi/${yts[0]}/hqdefault.jpg` : '') || before;
    return {
      slug: slugify(f),
      title: String(d.title || slugify(f).replace(/-/g, ' ')).trim(),
      // "category" is the main one; "categories" can add more (the project then shows up under each)
      ...(() => {
        const list = [d.category, ...(Array.isArray(d.categories) ? d.categories : [])]
          .map((c) => String(c || '').trim()).filter(Boolean)
          .filter((c, i, a) => a.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i);
        return { category: list[0] || '', categories: list };
      })(),
      date: String(d.date || ''),
      home: d.show_on_home !== false,
      description: String(d.description || ''),
      // software used on this project (e.g. "Adobe Photoshop"), shown on its page
      software: (Array.isArray(d.software) ? d.software : [d.software])
        .map((x) => String(x || '').trim()).filter(Boolean)
        .filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i),
      cover, images: own, yts, vids,
      redesign, before,
      seenAt: redesign ? String(d.seen_at || '').trim() : '',
      changes: redesign ? String(d.changes || '').split(/\n/).map((x) => x.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean) : [],
      // every upload switched off: nothing to show, so the project is left off the site
      everythingOff: !own.length && !vids.length && !before && hiddenRaw.length > 0,
      // every single piece of work in this project, videos first
      pieces: [
        ...vids.map((v) => ({ kind: 'video', id: v.id, short: v.short })),
        ...own.map((src) => ({ kind: 'image', src })),
      ],
    };
  })
  .filter((p) => p && !p.everythingOff)
  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));

// ---------- pieces of HTML ----------
const catSlug = (c) => slugify(c || 'other');
const swSlug = (s) => slugify(String(s || '').replace(/^adobe\s+/i, ''));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
// Shorts have a proper vertical thumbnail (oar2); fall back to the normal one if it is missing.
const thumbImg = (pc, alt, extra = '') => pc.kind === 'video'
  ? `<img src="${pc.short ? `https://i.ytimg.com/vi/${pc.id}/oar2.jpg` : ytThumb(pc.id)}"${pc.short ? ` onerror="this.onerror=null;this.src='${ytThumb(pc.id)}'"` : ''} alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`
  : `<img src="${esc(pc.src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`;
const counts = (p) => {
  const v = p.pieces.filter((x) => x.kind === 'video').length, i = p.pieces.length - v;
  return [v ? plural(v, 'video', 'videos') : '', i ? plural(i, 'design', 'designs') : ''].filter(Boolean).join(' · ');
};

// One playable/viewable tile. Opens in the on-page player (main.js); without JavaScript it is a normal link.
const piece = (p, pc, n, cls = '') => {
  const shape = pc.kind === 'image' ? 'img' : pc.short ? 'v' : 'h';
  const label = `${p.title} — ${pc.kind === 'video' ? 'video' : 'design'} ${n + 1}`;
  const href = pc.kind === 'video' ? (pc.short ? `https://www.youtube.com/shorts/${pc.id}` : `https://www.youtube.com/watch?v=${pc.id}`) : pc.src;
  const data = pc.kind === 'video' ? `data-yt="${pc.id}"${pc.short ? ' data-short' : ''}` : `data-img="${esc(pc.src)}"`;
  return `<a class="piece piece--${shape}${cls ? ' ' + cls : ''} reveal" href="${esc(href)}" ${data} data-title="${esc(p.title)}" data-project="/work/${p.slug}/" data-cats="${p.categories.map(catSlug).join(' ')}" data-sw="${p.software.map(swSlug).join(' ')}" target="_blank" rel="noopener" aria-label="${esc(pc.kind === 'video' ? 'Play ' : 'View ')}${esc(label)}">
		${thumbImg(pc, label)}
		${pc.kind === 'video' ? '<span class="piece-play" aria-hidden="true"></span>' : '<span class="piece-zoom" aria-hidden="true"></span>'}
		<span class="piece-info"><span class="piece-cat">${esc(p.category || (pc.kind === 'video' ? 'Video' : 'Design'))}</span><span class="piece-title">${esc(p.title)}</span></span>
	</a>`;
};

// All pieces, newest project first, mixed so neighbouring tiles come from different projects.
const mixPieces = (list, max = Infinity) => {
  const queues = list.map((p) => p.pieces.map((pc, n) => ({ p, pc, n })));
  const out = [];
  while (out.length < max && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < max) out.push(q.shift());
  return out;
};

// Little icons for the counts under each card (a stats row, like on Behance)
const ICON_IMG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.5" cy="6.5" r="1.3" fill="currentColor"/><path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const ICON_VID = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 5.6v4.8L10.4 8z" fill="currentColor"/></svg>';
const statIcons = (p) => {
  const v = p.pieces.filter((x) => x.kind === 'video').length, i = p.pieces.length - v;
  return [i ? `<span title="${plural(i, 'design', 'designs')}">${ICON_IMG}${i}</span>` : '', v ? `<span title="${plural(v, 'video', 'videos')}">${ICON_VID}${v}</span>` : ''].join('');
};

const card = (p) => `<a class="card${p.redesign ? ' card--rd' : ''} reveal" href="/work/${p.slug}/" data-cats="${p.categories.map(catSlug).join(' ')}" data-sw="${p.software.map(swSlug).join(' ')}"${p.category ? ` data-main="${esc(p.category)}"` : ''}>
	<div class="card-media">
		${p.cover ? `<img class="card-img" src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy" decoding="async">` : `<span class="card-ph" aria-hidden="true">${esc(p.title.charAt(0))}</span>`}
		${p.redesign && p.before ? `<img class="card-before" src="${esc(p.before)}" alt="" loading="lazy" decoding="async"><span class="card-split" aria-hidden="true"><i>Before</i><i>After</i></span>` : ''}
		${p.redesign ? '<span class="card-badge">Redesign</span>' : ''}
		<span class="card-hover" aria-hidden="true"><span class="card-view">${p.redesign ? 'See the redesign' : 'View project'} &rarr;</span></span>
	</div>
	<div class="card-meta">
		<span class="card-title">${esc(p.title)}</span>
		<span class="card-sub"><span class="card-cat">${esc(p.category || (p.redesign ? 'Redesign' : 'Project'))}</span><span class="card-stats">${statIcons(p)}</span></span>
	</div>
</a>`;

const empty = `<div class="empty"><span class="eyebrow">Coming soon</span><p>New work is on its way.</p></div>`;
const emptyRd = `<div class="empty empty--rd"><span class="eyebrow">Coming soon</span><p>The first redesign is on its way.</p></div>`;

// The two collections on the Portfolio page: own work, and Unsolicited Redesigns
const work = projects.filter((p) => !p.redesign);
const redesigns = projects.filter((p) => p.redesign);

// Category buttons for one collection (each tab on the Portfolio page has its own)
const filterBar = (list, scope, label) => {
  const cs = [];
  for (const p of list) for (const c of p.categories) if (!cs.some((x) => catSlug(x) === catSlug(c))) cs.push(c);
  if (cs.length < 2) return '';
  const n = (c) => list.filter((p) => p.categories.some((x) => catSlug(x) === catSlug(c))).length;
  return `<ul class="filters" data-scope="${scope}" aria-label="${esc(label)}">
			<li><button type="button" data-filter="all" aria-pressed="true">All <span class="n">${list.length}</span></button></li>
${cs.map((c) => `			<li><button type="button" data-filter="${catSlug(c)}" aria-pressed="false">${esc(c)} <span class="n">${n(c)}</span></button></li>`).join('\n')}
		</ul>`;
};

// Icons for the software chips on project pages (anything else shows as a plain text chip).
const SOFTWARE_ICONS = {
  'adobe photoshop': '/images/photoshop-300x300.png',
  'adobe illustrator': '/images/illustrator-300x300.png',
  'adobe premiere pro': '/images/premiere-pro-300x300.png',
  'adobe after effects': '/images/after-effects-300x300.png',
};
const softwareList = (p) => p.software.length
  ? `<div class="project-tools"><span class="project-tools-lbl">Software used</span><ul>${p.software.map((s) => {
    const ic = SOFTWARE_ICONS[s.toLowerCase()];
    return `<li class="tool-chip">${ic ? `<img src="${ic}" alt="" width="24" height="24" loading="lazy" decoding="async">` : ''}<span>${esc(s)}</span></li>`;
  }).join('')}</ul></div>`
  : '';

// Software dock on the Portfolio page: filter the work by the app it was made in.
const SW_META = {
  'photoshop': { code: 'Ps', color: '#31A8FF' },
  'illustrator': { code: 'Ai', color: '#FF9A00' },
  'premiere-pro': { code: 'Pr', color: '#EA77FF' },
  'after-effects': { code: 'Ae', color: '#9999FF' },
};
const swAll = [];
for (const p of work) for (const s of p.software) if (!swAll.some((x) => swSlug(x) === swSlug(s))) swAll.push(s);
const swOrder = Object.keys(SW_META);
swAll.sort((a, b) => ((swOrder.indexOf(swSlug(a)) + 1) || 99) - ((swOrder.indexOf(swSlug(b)) + 1) || 99));
const dock = swAll.length
  ? `<div class="sw-dock-wrap">
			<div class="sw-dock" role="group" aria-label="Filter by software">
				<span class="sw-dock-lbl">Made in</span>
${swAll.map((s) => {
    const k = swSlug(s), m = SW_META[k] || { code: s.replace(/^adobe\s+/i, '').slice(0, 2), color: '#F2AB01' };
    const n = work.filter((p) => p.software.some((x) => swSlug(x) === k)).reduce((a, p) => a + p.pieces.length, 0);
    const ic = SOFTWARE_ICONS[s.toLowerCase()];
    return `				<button type="button" class="sw-app" data-sw-filter="${k}" data-sw-name="${esc(s.replace(/^adobe\s+/i, ''))}" data-n="${n}" aria-pressed="false" style="--app:${m.color}">
					<span class="sw-app-ic">${ic ? `<img src="${ic}" alt="" width="56" height="56">` : `<b>${esc(m.code)}</b>`}</span>
					<span class="sw-app-tip">${esc(s)} <i>${n}</i></span>
					<span class="sw-app-dot" aria-hidden="true"></span>
					<span class="screen-reader-text">${esc(s)}, ${n} pieces</span>
				</button>`;
  }).join('\n')}
			</div>
			<p class="sw-status" aria-live="polite"><span class="sw-status-txt">Tap an app to see the work made in it</span></p>
		</div>`
  : '';

const ROLE = 'Graphic Designer &amp; Motion Graphics Video Editor';
const AVATAR = '/images/21515369481-1024x1024.jpg';
const longDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return '';
  return `${+m[3]} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m[2] - 1]} ${m[1]}`;
};

// Before / After comparison for an Unsolicited Redesign (drag the handle, or use the arrow keys)
const compare = (p) => {
  const after = p.images[0] || p.cover;
  if (!p.before || !after) return '';
  return `<div class="rd-compare" style="--pos:50%">
				<img class="rd-after" src="${esc(after)}" alt="${esc(p.title)} — my redesign" loading="eager">
				<img class="rd-before" src="${esc(p.before)}" alt="${esc(p.title)} — the original design" loading="eager">
				<span class="rd-line" aria-hidden="true"><span class="rd-knob"></span></span>
				<span class="rd-tag rd-tag--before" aria-hidden="true">Before</span>
				<span class="rd-tag rd-tag--after" aria-hidden="true">After</span>
				<input class="rd-range" type="range" min="0" max="100" value="50" aria-label="Compare the original and the redesign: slide left to see more of the redesign">
			</div>`;
};

function projectBody(p, i) {
  const prev = projects[i - 1], next = projects[i + 1];
  const lite = (v, n) => `<a class="yt-lite${v.short ? ' yt-lite--v' : ''}" href="${v.short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`}" data-yt="${v.id}" data-label="${esc(p.title)}${p.vids.length > 1 ? ` — video ${n + 1}` : ''}" target="_blank" rel="noopener" aria-label="Play ${esc(p.title)}${p.vids.length > 1 ? ` video ${n + 1}` : ''}">${thumbImg({ kind: 'video', ...v }, '', n < 4 ? ' loading="eager"' : '')}<span class="piece-play" aria-hidden="true"></span></a>`;
  const wide = p.vids.filter((v) => !v.short), tall = p.vids.filter((v) => v.short);
  const video = [
    ...wide.map((v) => `<div class="video">${lite(v, p.vids.indexOf(v))}</div>`),
    tall.length ? `<div class="shorts${tall.length < 3 ? ' shorts--few' : ''}">${tall.map((v) => lite(v, p.vids.indexOf(v))).join('')}</div>` : '',
  ].filter(Boolean).join('\n\t\t\t');
  // On a redesign page the first "after" image is already in the comparison, so the gallery shows the rest
  const shots = p.redesign && p.before ? p.images.slice(1) : p.images;
  const gallery = shots.length
    ? `<div class="gallery">\n${shots.map((src, n) => `				<figure><img src="${esc(src)}" alt="${esc(p.title)} — image ${n + 1}" loading="${n < 2 ? 'eager' : 'lazy'}"></figure>`).join('\n')}\n			</div>`
    : '';
  const crumb = p.redesign
    ? `<a href="/portfolio/#redesigns">Unsolicited Redesigns</a>`
    : `<a href="/portfolio/">Portfolio</a>`;
  const rdCase = p.redesign ? `<section class="rd-case" aria-label="Before and after">
			${compare(p)}
			<div class="rd-side">
				${p.changes.length ? `<h2>What I changed</h2>
				<ol class="rd-changes">${p.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>` : ''}
				${p.seenAt ? `<p class="rd-seen"><span>Original spotted at</span>${esc(p.seenAt)}</p>` : ''}
				<p class="rd-note">A personal concept. Not affiliated with or commissioned by the original business. The original design belongs to its owner and is shown only for comparison.</p>
			</div>
		</section>` : '';
  // "More by Pavithran": same kind of work first (redesigns with redesigns), newest first
  const others = projects.filter((x) => x !== p);
  const more = [...others.filter((x) => x.redesign === p.redesign), ...others.filter((x) => x.redesign !== p.redesign)].slice(0, 4);
  const meta = [
    p.date ? `<div><dt>Published</dt><dd>${longDate(p.date)}</dd></div>` : '',
    p.categories.length ? `<div><dt>${p.categories.length > 1 ? 'Categories' : 'Category'}</dt><dd>${p.categories.map(esc).join(', ')}</dd></div>` : '',
    counts(p) ? `<div><dt>In this project</dt><dd>${counts(p)}</dd></div>` : '',
  ].join('');
  return `	<header class="pj-head">
		<div class="wrap">
			<nav class="pj-crumbs" aria-label="Breadcrumb">${crumb}${p.category ? ` <span aria-hidden="true">/</span> <span>${esc(p.category)}</span>` : ''}</nav>
			${p.redesign ? '<span class="pj-kind">Unsolicited Redesign</span>' : ''}
			<h1>${esc(p.title)}</h1>
			<div class="pj-by">
				<a class="pj-owner" href="/about-me/"><img src="${AVATAR}" alt="" width="44" height="44"><span><b>Pavithran</b><small>${ROLE}</small></span></a>
				<a class="btn btn--gold pj-hire" href="/contact/">Hire me</a>
			</div>
			${p.description ? `<div class="project-desc">${paragraphs(p.description)}</div>` : ''}
		</div>
	</header>
	<div class="wrap pj-wrap">
		${rdCase}
		<div class="entry pj-canvas">
			${video}
			${gallery}
		</div>
		<div class="pj-info">
			<div class="pj-info-who">
				<img src="${AVATAR}" alt="" width="64" height="64">
				<div><b>Pavithran</b><span>${ROLE}</span><a class="text-link" href="/contact/">Work with me &rarr;</a></div>
			</div>
			<dl class="pj-meta">${meta}</dl>
			${softwareList(p)}
		</div>
		${more.length ? `<section class="pj-more" aria-labelledby="pj-more-h">
			<div class="pj-more-head"><h2 id="pj-more-h">More by Pavithran</h2><a class="text-link" href="/portfolio/${p.redesign ? '#redesigns' : ''}">View all &rarr;</a></div>
			<div class="work-grid">
${more.map(card).join('\n')}
			</div>
		</section>` : ''}
		<nav class="pager" aria-label="Project navigation">
			${prev ? `<a class="text-link" href="/work/${prev.slug}/">&larr; ${esc(prev.title)}</a>` : '<span></span>'}
			<a class="text-link" href="/portfolio/">All projects</a>
			${next ? `<a class="text-link" href="/work/${next.slug}/">${esc(next.title)} &rarr;</a>` : '<span></span>'}
		</nav>
	</div>
	<div class="pj-rail" aria-label="Project actions">
		<a href="/contact/" class="pj-rail-btn pj-rail-btn--hire"><img src="${AVATAR}" alt=""><span>Hire me</span></a>
		<button type="button" class="pj-rail-btn" data-share><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="15" cy="4.5" r="2.3"/><circle cx="5" cy="10" r="2.3"/><circle cx="15" cy="15.5" r="2.3"/><path d="M7 8.9l6-3.3M7 11.1l6 3.3"/></svg><span>Share</span></button>
		<a href="#main" class="pj-rail-btn"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M5 9l5-5 5 5"/></svg><span>Top</span></a>
	</div>`;
}

// ---------- write the site ----------
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(SRC, OUT);
fs.rmSync(path.join(OUT, '_project.html'));
copyDir(path.join(ROOT, 'images'), path.join(OUT, 'images'));

const fill = (file, map) => {
  const f = path.join(OUT, file);
  let s = fs.readFileSync(f, 'utf8');
  for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
  fs.writeFileSync(f, s);
};

const homeList = projects.filter((p) => p.home);
// Redesigns are not part of the work wall or the counts: their "before" is someone else's design
const allPieces = work.reduce((a, p) => a + p.pieces.length, 0);
const allVideos = work.reduce((a, p) => a + p.vids.length, 0);
const allDesigns = allPieces - allVideos;
const homeWall = mixPieces(homeList.filter((p) => !p.redesign), 10);
// Lead with a wide piece (a landscape video or a design) as the big feature tile
const lead = homeWall.findIndex((x) => x.pc.kind === 'image' || !x.pc.short);
if (lead > 0) homeWall.unshift(homeWall.splice(lead, 1)[0]);
// Trim so the wall ends on a full row (5 columns x 2 rows per band; big/design tiles take 4 cells, others 2)
const cells = (x, i) => (i === 0 && (x.pc.kind === 'image' || !x.pc.short)) || x.pc.kind === 'image' ? 4 : 2;
while (homeWall.length > 4 && homeWall.reduce((a, x, i) => a + cells(x, i), 0) % 10) homeWall.pop();
const statLine = [plural(work.length, 'project', 'projects'), allVideos ? plural(allVideos, 'video', 'videos') : '', allDesigns ? plural(allDesigns, 'design', 'designs') : ''].filter(Boolean);
const projChip = (p) => `<a class="proj-chip" href="/work/${p.slug}/">${p.pieces[0] ? thumbImg(p.pieces[0], '') : ''}<span><b>${esc(p.title)}</b><small>${counts(p) || esc(p.category)}</small></span><i aria-hidden="true">&rarr;</i></a>`;
fill('index.html', {
  '<!--HOME_WALL-->': homeWall.length ? homeWall.map((x, i) => piece(x.p, x.pc, x.n, i === 0 && (x.pc.kind === 'image' || !x.pc.short) ? 'piece--big' : '')).join('\n') : empty,
  '<!--HOME_PROJECTS-->': homeList.map(projChip).join('\n'),
  '<!--WORK_STATS-->': statLine.map((t) => `<span>${t}</span>`).join(''),
});
const tools = swAll.map((s) => {
  const ic = SOFTWARE_ICONS[s.toLowerCase()];
  return ic ? `<li title="${esc(s)}"><img src="${ic}" alt="${esc(s)}" width="36" height="36" loading="lazy"></li>` : `<li class="pf-tool-txt" title="${esc(s)}">${esc(s.replace(/^adobe\s+/i, ''))}</li>`;
}).join('');
const pfStat = (n, one, many) => `<li><b>${n}</b><span>${n === 1 ? one : many}</span></li>`;
fill('portfolio/index.html', {
  '<!--PF_STATS-->': [pfStat(work.length, 'Project', 'Projects'), pfStat(allDesigns, 'Design', 'Designs'), pfStat(allVideos, 'Video', 'Videos'), redesigns.length ? pfStat(redesigns.length, 'Redesign', 'Redesigns') : ''].join(''),
  '<!--PF_TOOLS-->': tools,
  '<!--N_WORK-->': String(work.length),
  '<!--N_RD-->': String(redesigns.length),
  '<!--WORK_FILTERS-->': filterBar(work, 'work', 'Filter projects by category') + dock,
  '<!--WORK_CARDS-->': work.length ? work.map(card).join('\n') : empty,
  '<!--ALL_PIECES-->': mixPieces(work).map((x) => piece(x.p, x.pc, x.n)).join('\n'),
  '<!--RD_FILTERS-->': filterBar(redesigns, 'rd', 'Filter redesigns by category'),
  '<!--RD_CARDS-->': redesigns.length ? redesigns.map(card).join('\n') : emptyRd,
});

// ---------- testimonials (only real ones, added in the admin page) ----------
let testimonials = [];
try {
  if (fs.existsSync(TESTIMONIALS)) {
    const d = JSON.parse(fs.readFileSync(TESTIMONIALS, 'utf8'));
    testimonials = (Array.isArray(d) ? d : d.testimonials || []).filter((t) => t && t.show !== false && String(t.name || '').trim() && String(t.quote || '').trim());
  }
} catch (e) { problems.push(`testimonials.json: not valid JSON (${e.message}) - testimonials not shown`); }
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
const tmSection = (eyebrow) => !testimonials.length ? '' : `<section class="tm" aria-labelledby="tm-h">
	<div class="wrap">
		<div class="section-head"><div><span class="eyebrow">${eyebrow}</span><h2 id="tm-h">What People <em>Say</em></h2></div></div>
		<div class="tm-grid">
${testimonials.map((t) => `			<figure class="tm-card reveal">
				<blockquote>${paragraphs(t.quote)}</blockquote>
				<figcaption class="tm-who">
					<span class="tm-av" aria-hidden="true">${esc(initials(t.name))}</span>
					<span><b>${/^https:\/\//.test(t.link || '') ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.name)}</a>` : esc(t.name)}</b><small>${esc([t.role, t.company].filter(Boolean).join(', '))}</small></span>
					${t.relation ? `<span class="tm-rel">${esc(t.relation)}</span>` : ''}
				</figcaption>
			</figure>`).join('\n')}
		</div>
	</div>
</section>`;
fill('index.html', { '<!--TESTIMONIALS-->': tmSection('04 &mdash; Testimonials') });
fill('about-me/index.html', { '<!--TESTIMONIALS-->': tmSection('Testimonials') });
if (testimonials.length) fill('index.html', { '04 &mdash; My software': '05 &mdash; My software' });

const tpl = fs.readFileSync(path.join(SRC, '_project.html'), 'utf8');
projects.forEach((p, i) => {
  const desc = (p.description.replace(/\s+/g, ' ').trim().slice(0, 155)) || `${p.title}${p.category ? ` — ${p.category.toLowerCase()} work` : ''} by Pavithran, Graphic Designer & Motion Graphics Video Editor in Tirupur, Tamil Nadu.`;
  const html = tpl.split('{{TITLE}}').join(esc(p.title)).split('{{DESC}}').join(esc(desc)).split('{{PROJECT}}').join(projectBody(p, i));
  const dir = path.join(OUT, 'work', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
});

// ---------- SEO: canonical links, share previews, structured data, sitemap ----------
const SITE = (process.env.SITE_URL || 'https://pavithran.pages.dev').replace(/\/+$/, '');
const abs = (u) => (/^https?:\/\//.test(u) ? u : SITE + (u.startsWith('/') ? u : '/' + u));
const PORTRAIT = '/images/21515369481-1024x1024.jpg';
const SOCIALS = [
  'https://www.linkedin.com/in/pavithran-e-wv9465445/',
  'https://www.instagram.com/ig_whitevamp/',
  'https://www.youtube.com/@pvkcreationz',
];
const person = {
  '@type': 'Person',
  '@id': SITE + '/#person',
  name: 'Pavithran',
  jobTitle: 'Graphic Designer & Motion Graphics Video Editor',
  url: SITE + '/',
  image: abs(PORTRAIT),
  email: 'mailto:Pavithranwv@gmail.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Tirupur', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
  knowsAbout: ['Graphic Design', 'Motion Graphics', 'Video Editing', 'Social Media Posters', 'Branding', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe Premiere Pro', 'Adobe After Effects'],
  sameAs: SOCIALS,
};
const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const NOINDEX = new Set(['/thanks/', '/404.html', '/recommend/']);
const today = new Date().toISOString().slice(0, 10);
const pages = []; // for the sitemap

function seo(file, urlPath, { image, ld, lastmod } = {}) {
  const f = path.join(OUT, file);
  let s = fs.readFileSync(f, 'utf8');
  const url = SITE + urlPath;
  const tags = [];
  if (NOINDEX.has(urlPath)) {
    tags.push('<meta name="robots" content="noindex">');
  } else {
    tags.push(`<link rel="canonical" href="${url}">`);
    pages.push({ url, lastmod: lastmod || today });
  }
  tags.push(
    `<meta property="og:url" content="${url}">`,
    '<meta property="og:site_name" content="Pavithran">',
    '<meta property="og:locale" content="en_IN">',
    `<meta property="og:image" content="${esc(abs(image || PORTRAIT))}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="theme-color" content="#163B58">',
  );
  if (ld) tags.push(ldScript({ '@context': 'https://schema.org', '@graph': ld }));
  s = s.replace('</head>', tags.join('\n') + '\n</head>');
  fs.writeFileSync(f, s);
}

seo('index.html', '/', {
  ld: [person, { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'Pavithran', publisher: { '@id': SITE + '/#person' } }],
  lastmod: projects[0] ? projects[0].date : today,
});
seo('portfolio/index.html', '/portfolio/', {
  lastmod: projects[0] ? projects[0].date : today,
  ld: [{
    '@type': 'CollectionPage', url: SITE + '/portfolio/', name: 'Portfolio – Pavithran', author: { '@id': SITE + '/#person' },
    hasPart: projects.map((p) => ({ '@type': 'CreativeWork', name: p.title, url: `${SITE}/work/${p.slug}/` })),
  }, person],
});
seo('about-me/index.html', '/about-me/', { ld: [{ '@type': 'ProfilePage', url: SITE + '/about-me/', mainEntity: { '@id': SITE + '/#person' } }, person] });
seo('contact/index.html', '/contact/', { ld: [{ '@type': 'ContactPage', url: SITE + '/contact/', about: { '@id': SITE + '/#person' } }, person] });
seo('thanks/index.html', '/thanks/');
seo('recommend/index.html', '/recommend/');
seo('404.html', '/404.html');
for (const p of projects) {
  seo(`work/${p.slug}/index.html`, `/work/${p.slug}/`, {
    image: p.cover || PORTRAIT,
    lastmod: p.date || today,
    ld: [{
      '@type': 'CreativeWork',
      name: p.title,
      url: `${SITE}/work/${p.slug}/`,
      ...(p.cover ? { image: abs(p.cover) } : {}),
      ...(p.categories.length ? { genre: p.categories.length > 1 ? p.categories : p.categories[0] } : {}),
      ...(p.date ? { dateCreated: p.date } : {}),
      ...(p.description ? { description: p.description.replace(/\s+/g, ' ').trim() } : {}),
      ...(p.yts.length ? { video: p.yts.map((id) => ({ '@type': 'VideoObject', name: p.title, embedUrl: `https://www.youtube.com/embed/${id}`, contentUrl: `https://www.youtube.com/watch?v=${id}`, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, ...(p.date ? { uploadDate: p.date } : {}), description: p.description ? p.description.replace(/\s+/g, ' ').trim() : `${p.title} by Pavithran` })) } : {}),
      creator: { '@id': SITE + '/#person' },
    }, person],
  });
}

fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map((p) => `  <url><loc>${p.url}</loc><lastmod>${/^\d{4}-\d{2}-\d{2}$/.test(p.lastmod) ? p.lastmod : today}</lastmod></url>`).join('\n') +
  '\n</urlset>\n');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);

// ---------- report ----------
const missing = [];
for (const p of projects) for (const src of [p.cover, ...p.images]) {
  if (src && src.startsWith('/') && !fs.existsSync(path.join(OUT, src))) missing.push(`${p.slug}: ${src}`);
}
console.log(`Built ${projects.length} project(s): ${projects.map((p) => p.slug).join(', ') || 'none'}`);
for (const m of problems) console.warn('WARNING ' + m);
for (const m of missing) console.warn('WARNING missing image ' + m);
