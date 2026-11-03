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
    const images = asList(d.images);
    // "youtube" can be one link or a list of links
    const yts = (Array.isArray(d.youtube) ? d.youtube : [d.youtube])
      .map((v) => youtubeId(v && typeof v === 'object' ? (v.link || v.url || '') : v)).filter(Boolean);
    const cover = imgPath(d.cover) || images[0] || (yts[0] ? `https://i.ytimg.com/vi/${yts[0]}/hqdefault.jpg` : '');
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
      cover, images, yts,
    };
  })
  .filter(Boolean)
  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));

// ---------- pieces of HTML ----------
const catSlug = (c) => slugify(c || 'other');

const card = (p) => `<a class="card reveal" href="/work/${p.slug}/" data-cats="${p.categories.map(catSlug).join(' ')}"${p.category ? ` data-main="${esc(p.category)}"` : ''}>
	<div class="card-media">
		${p.cover ? `<img src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy">` : `<span class="card-ph" aria-hidden="true">${esc(p.title.charAt(0))}</span>`}
		<span class="card-arrow" aria-hidden="true">&nearr;</span>
		<span class="card-info">${p.category ? `<span class="card-cat">${esc(p.category)}</span>` : ''}<span class="card-title">${esc(p.title)}</span></span>
	</div>
</a>`;

const empty = `<div class="empty"><span class="eyebrow">Coming soon</span><p>New work is on its way.</p></div>`;

const cats = [];
for (const p of projects) for (const c of p.categories) if (!cats.some((x) => catSlug(x) === catSlug(c))) cats.push(c);
const filters = cats.length > 1
  ? `<ul class="filters" aria-label="Filter projects">
			<li><button type="button" data-filter="all" aria-pressed="true">All</button></li>
${cats.map((c) => `			<li><button type="button" data-filter="${catSlug(c)}" aria-pressed="false">${esc(c)}</button></li>`).join('\n')}
		</ul>`
  : '';

function projectBody(p, i) {
  const prev = projects[i - 1], next = projects[i + 1];
  const video = p.yts.map((id, n) => `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(p.title)}${p.yts.length > 1 ? ` — video ${n + 1}` : ''}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`).join('\n\t\t\t');
  const gallery = p.images.length
    ? `<div class="gallery">\n${p.images.map((src, n) => `				<figure><img src="${esc(src)}" alt="${esc(p.title)} — image ${n + 1}" loading="${n < 3 ? 'eager' : 'lazy'}"></figure>`).join('\n')}\n			</div>`
    : '';
  return `	<header class="page-head">
		<div class="wrap">
			${p.categories.length ? `<span class="eyebrow">${p.categories.map(esc).join(' &middot; ')}</span>` : ''}
			<h1>${esc(p.title)}</h1>
			${p.description ? `<div class="project-desc">${paragraphs(p.description)}</div>` : ''}
		</div>
	</header>
	<div class="wrap">
		<div class="entry">
			${video}
			${gallery}
		</div>
		<nav class="pager" aria-label="Project navigation">
			${prev ? `<a class="text-link" href="/work/${prev.slug}/">&larr; ${esc(prev.title)}</a>` : '<span></span>'}
			<a class="text-link" href="/portfolio/">All projects</a>
			${next ? `<a class="text-link" href="/work/${next.slug}/">${esc(next.title)} &rarr;</a>` : '<span></span>'}
		</nav>
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

const homeList = projects.filter((p) => p.home).slice(0, 6);
fill('index.html', { '<!--HOME_CARDS-->': homeList.length ? homeList.map(card).join('\n') : empty });
fill('portfolio/index.html', {
  '<!--FILTERS-->': filters,
  '<!--ALL_CARDS-->': projects.length ? projects.map(card).join('\n') : empty,
});

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

const NOINDEX = new Set(['/thanks/', '/404.html']);
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
