(function () {
	'use strict';

	var root = document.documentElement;

	// Preloader: shown on the first page of a visit, then skipped so navigation stays instant.
	var pl = document.getElementById('preloader');
	function finishPreloader() {
		root.classList.add('pl-done');
		try { sessionStorage.setItem('pvcPl', '1'); } catch (e) {}
		if (pl) {
			setTimeout(function () { if (pl.parentNode) { pl.parentNode.removeChild(pl); } }, 1100);
		}
	}
	if (!pl || root.classList.contains('pl-skip')) {
		finishPreloader();
	} else {
		var counter = document.getElementById('pl-count');
		var t0 = Date.now();
		var countUp = function () {
			var p = Math.min(1, (Date.now() - t0) / 1200);
			if (counter) { counter.textContent = Math.round(p * 100); }
			if (p < 1) { requestAnimationFrame(countUp); }
		};
		requestAnimationFrame(countUp);
		var release = function () {
			var elapsed = Date.now() - t0;
			setTimeout(finishPreloader, Math.max(0, 1250 - elapsed)); // brief minimum so the icon is seen, never longer than needed
		};
		if (document.readyState === 'complete') { release(); } else { window.addEventListener('load', release); }
	}

	// Mouse-follower: a dot that tracks the pointer and a ring that trails it.
	// Only on devices with a real mouse, and not for people who ask for reduced motion.
	var hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
	var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (hasMouse && !calm) {
		var dot = document.createElement('span');
		var ring = document.createElement('span');
		dot.className = 'cursor-dot';
		ring.className = 'cursor-ring';
		dot.setAttribute('aria-hidden', 'true');
		ring.setAttribute('aria-hidden', 'true');
		document.body.appendChild(ring);
		document.body.appendChild(dot);

		var x = 0, y = 0, rx = 0, ry = 0, running = false, seen = false;
		var tick = function () {
			rx += (x - rx) * 0.16;
			ry += (y - ry) * 0.16;
			ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
			if (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1) {
				requestAnimationFrame(tick);
			} else {
				running = false;
			}
		};
		document.addEventListener('mousemove', function (e) {
			x = e.clientX;
			y = e.clientY;
			dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
			if (!seen) { seen = true; rx = x; ry = y; }
			root.classList.add('cursor-on');
			if (!running) { running = true; requestAnimationFrame(tick); }
		}, { passive: true });
		root.addEventListener('mouseleave', function () { root.classList.remove('cursor-on'); });
		document.addEventListener('mouseover', function (e) {
			var t = e.target;
			var onLink = !!(t && t.closest && t.closest('a, button, [role="button"], input, textarea, select, label, summary, .card'));
			root.classList.toggle('cursor-link', onLink);
		});
		document.addEventListener('mousedown', function () { root.classList.add('cursor-down'); });
		document.addEventListener('mouseup', function () { root.classList.remove('cursor-down'); });
	}

	// Interactive background: reacts to mouse movement and page scroll (static for reduced motion)
	if (!calm) {
		var fx = document.createElement('div');
		fx.className = 'bg-fx';
		fx.setAttribute('aria-hidden', 'true');
		fx.innerHTML = '<i class="bg-dots"></i><i class="bg-blob bg-b1"></i><i class="bg-blob bg-b2"></i><i class="bg-blob bg-b3"></i><i class="bg-spot"></i>';
		document.body.insertBefore(fx, document.body.firstChild);
		var tmx = window.innerWidth / 2, tmy = window.innerHeight / 2, smx = tmx, smy = tmy, ssy = window.scrollY, tsy = ssy, fxRun = false;
		var fxTick = function () {
			smx += (tmx - smx) * 0.1;
			smy += (tmy - smy) * 0.1;
			ssy += (tsy - ssy) * 0.12;
			root.style.setProperty('--mx', smx.toFixed(1) + 'px');
			root.style.setProperty('--my', smy.toFixed(1) + 'px');
			root.style.setProperty('--nx', ((smx / window.innerWidth) * 2 - 1).toFixed(3));
			root.style.setProperty('--ny', ((smy / window.innerHeight) * 2 - 1).toFixed(3));
			root.style.setProperty('--sy', ssy.toFixed(1));
			if (Math.abs(tmx - smx) > 0.3 || Math.abs(tmy - smy) > 0.3 || Math.abs(tsy - ssy) > 0.3) {
				requestAnimationFrame(fxTick);
			} else {
				fxRun = false;
			}
		};
		var fxGo = function () { if (!fxRun) { fxRun = true; requestAnimationFrame(fxTick); } };
		document.addEventListener('mousemove', function (e) { tmx = e.clientX; tmy = e.clientY; fxGo(); }, { passive: true });
		window.addEventListener('scroll', function () { tsy = window.scrollY; fxGo(); }, { passive: true });
		fxGo();
	}

	// Mobile menu
	var header = document.getElementById('site-header');
	var toggle = document.querySelector('.nav-toggle');
	if (header && toggle) {
		toggle.addEventListener('click', function () {
			var open = header.classList.toggle('nav-open');
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && header.classList.contains('nav-open')) {
				header.classList.remove('nav-open');
				toggle.setAttribute('aria-expanded', 'false');
				toggle.focus();
			}
		});
	}

	// Portfolio filters: category buttons + the software dock work together
	// (all projects stay visible if JavaScript is off)
	var buttons = document.querySelectorAll('[data-filter]');
	var apps = document.querySelectorAll('[data-sw-filter]');
	var cards = document.querySelectorAll('.work-grid [data-cats], .wall [data-cats]');
	var cur = { cat: 'all', sw: '', label: '' };
	var swStatus = document.querySelector('.sw-status-txt');
	var applyFilters = function () {
		var shown = 0;
		cards.forEach(function (c) {
			var cats = (c.getAttribute('data-cats') || '').split(' ');
			var sws = (c.getAttribute('data-sw') || '').split(' ');
			c.hidden = !((cur.cat === 'all' || cats.indexOf(cur.cat) !== -1) && (!cur.sw || sws.indexOf(cur.sw) !== -1));
			if (!c.hidden) { c.classList.add('is-in'); if (c.classList.contains('piece')) shown++; }
			// The tag shows the category you're looking at; "All" shows the main one.
			var tag = c.querySelector('.card-cat');
			if (tag) { tag.textContent = cur.cat === 'all' ? (c.getAttribute('data-main') || tag.textContent) : cur.label; }
		});
		if (swStatus) {
			var active = cur.sw && document.querySelector('[data-sw-filter="' + cur.sw + '"]');
			swStatus.parentNode.classList.toggle('is-on', !!active);
			swStatus.textContent = active
				? (shown ? shown + (shown === 1 ? ' piece' : ' pieces') + ' made in ' + active.getAttribute('data-sw-name') : 'Nothing made in ' + active.getAttribute('data-sw-name') + ' here yet') + ' — tap again to close'
				: 'Tap an app to see the work made in it';
		}
	};
	buttons.forEach(function (btn) {
		btn.addEventListener('click', function () {
			cur.cat = btn.getAttribute('data-filter');
			cur.label = btn.textContent.replace(/\s*\d+\s*$/, '').trim();
			buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
			applyFilters();
		});
	});
	apps.forEach(function (app) {
		app.addEventListener('click', function () {
			var k = app.getAttribute('data-sw-filter');
			cur.sw = cur.sw === k ? '' : k;
			apps.forEach(function (a) { a.setAttribute('aria-pressed', a.getAttribute('data-sw-filter') === cur.sw ? 'true' : 'false'); });
			if (cur.sw) { app.classList.remove('is-launch'); void app.offsetWidth; app.classList.add('is-launch'); }
			applyFilters();
		});
		app.addEventListener('animationend', function () { app.classList.remove('is-launch'); });
	});
	// Dock magnification: icons near the pointer grow, like a real app dock
	var dockEl = document.querySelector('.sw-dock');
	if (dockEl && window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
		dockEl.addEventListener('mousemove', function (e) {
			apps.forEach(function (a) {
				var r = a.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
				a.style.setProperty('--mag', Math.max(0, 1 - d / 150).toFixed(3));
			});
		});
		dockEl.addEventListener('mouseleave', function () { apps.forEach(function (a) { a.style.setProperty('--mag', 0); }); });
	}

	// Project images: click to view large, with previous/next and Esc to close
	var shots = Array.prototype.slice.call(document.querySelectorAll('.entry .gallery img'));
	if (shots.length) {
		var lb = document.createElement('div');
		lb.className = 'lightbox';
		lb.setAttribute('role', 'dialog');
		lb.setAttribute('aria-modal', 'true');
		lb.setAttribute('aria-label', 'Image viewer');
		lb.innerHTML = '<button class="lb-close" type="button" aria-label="Close">&times;</button><button class="lb-prev" type="button" aria-label="Previous image">&larr;</button><img alt=""><button class="lb-next" type="button" aria-label="Next image">&rarr;</button>';
		document.body.appendChild(lb);
		var lbImg = lb.querySelector('img');
		var cur = 0;
		var show = function (i) {
			cur = (i + shots.length) % shots.length;
			lbImg.src = shots[cur].getAttribute('data-full') || shots[cur].currentSrc || shots[cur].src;
			lbImg.alt = shots[cur].alt || '';
			lb.classList.add('is-open');
			document.body.classList.add('lb-open');
		};
		var hide = function () { lb.classList.remove('is-open'); document.body.classList.remove('lb-open'); };
		shots.forEach(function (img, i) { img.addEventListener('click', function (e) { e.preventDefault(); show(i); }); });
		lb.querySelector('.lb-close').addEventListener('click', hide);
		lb.querySelector('.lb-prev').addEventListener('click', function () { show(cur - 1); });
		lb.querySelector('.lb-next').addEventListener('click', function () { show(cur + 1); });
		lb.addEventListener('click', function (e) { if (e.target === lb) { hide(); } });
		document.addEventListener('keydown', function (e) {
			if (!lb.classList.contains('is-open')) { return; }
			if (e.key === 'Escape') { hide(); }
			if (e.key === 'ArrowLeft') { show(cur - 1); }
			if (e.key === 'ArrowRight') { show(cur + 1); }
		});
	}

	// Videos on project pages: show the thumbnail, load YouTube only when someone presses play
	document.querySelectorAll('.yt-lite').forEach(function (a) {
		a.addEventListener('click', function (e) {
			e.preventDefault();
			var f = document.createElement('iframe');
			f.src = 'https://www.youtube-nocookie.com/embed/' + a.getAttribute('data-yt') + '?autoplay=1&rel=0&playsinline=1';
			f.title = a.getAttribute('data-label') || 'Video';
			f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
			f.allowFullscreen = true;
			a.appendChild(f);
			a.removeAttribute('href');
		}, { once: true });
	});

	// On-page player for the work wall: tap a piece to watch it here, arrows for the next one
	var pieces = Array.prototype.slice.call(document.querySelectorAll('.piece[data-yt], .piece[data-img]'));
	if (pieces.length) {
		var pv = document.createElement('div');
		pv.className = 'player';
		pv.setAttribute('role', 'dialog');
		pv.setAttribute('aria-modal', 'true');
		pv.setAttribute('aria-label', 'Work player');
		pv.innerHTML = '<div class="player-stage"></div><button class="pv-close" type="button" aria-label="Close">&times;</button><button class="pv-prev" type="button" aria-label="Previous piece">&larr;</button><button class="pv-next" type="button" aria-label="Next piece">&rarr;</button><div class="player-cap"><span class="pt"></span><span class="ct"></span><a class="pp" href="#">Open project &rarr;</a></div>';
		document.body.appendChild(pv);
		var stage = pv.querySelector('.player-stage');
		var plCur = 0, plList = [], opener = null;
		var visible = function () { return pieces.filter(function (x) { return !x.hidden; }); };
		var play = function (i) {
			plCur = (i + plList.length) % plList.length;
			var el = plList[plCur], yt = el.getAttribute('data-yt');
			stage.innerHTML = '';
			pv.classList.toggle('is-short', el.hasAttribute('data-short'));
			pv.classList.toggle('is-img', !yt);
			if (yt) {
				var f = document.createElement('iframe');
				f.src = 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0&playsinline=1';
				f.title = el.getAttribute('aria-label') || 'Video';
				f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
				f.allowFullscreen = true;
				stage.appendChild(f);
			} else {
				var im = document.createElement('img');
				im.src = el.getAttribute('data-img'); im.alt = el.getAttribute('aria-label') || '';
				stage.appendChild(im);
			}
			pv.querySelector('.pt').textContent = el.getAttribute('data-title') || '';
			pv.querySelector('.ct').textContent = (plCur + 1) + ' / ' + plList.length;
			pv.querySelector('.pp').href = el.getAttribute('data-project') || '/portfolio/';
			var many = plList.length > 1;
			pv.querySelector('.pv-prev').hidden = !many; pv.querySelector('.pv-next').hidden = !many;
		};
		var close = function () {
			pv.classList.remove('is-open'); stage.innerHTML = ''; document.body.classList.remove('lb-open');
			if (opener) { opener.focus(); }
		};
		pieces.forEach(function (el) {
			el.addEventListener('click', function (e) {
				if (e.metaKey || e.ctrlKey || e.shiftKey) { return; }
				e.preventDefault();
				opener = el;
				plList = visible();
				pv.classList.add('is-open'); document.body.classList.add('lb-open');
				play(plList.indexOf(el));
				pv.querySelector('.pv-close').focus();
			});
		});
		pv.querySelector('.pv-close').addEventListener('click', close);
		pv.querySelector('.pv-prev').addEventListener('click', function () { play(plCur - 1); });
		pv.querySelector('.pv-next').addEventListener('click', function () { play(plCur + 1); });
		pv.addEventListener('click', function (e) { if (e.target === pv) { close(); } });
		document.addEventListener('keydown', function (e) {
			if (!pv.classList.contains('is-open')) { return; }
			if (e.key === 'Escape') { close(); }
			if (e.key === 'ArrowLeft') { play(plCur - 1); }
			if (e.key === 'ArrowRight') { play(plCur + 1); }
		});
	}

	// Gentle reveal on scroll
	var items = document.querySelectorAll('.reveal');
	if ('IntersectionObserver' in window) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (en) {
				if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
			});
		}, { threshold: 0.12 });
		items.forEach(function (el) { io.observe(el); });
	} else {
		items.forEach(function (el) { el.classList.add('is-in'); });
	}

	// Decorative timecode in the home hero
	var tc = document.querySelector('[data-timecode]');
	if (tc && !calm) {
		var t = 0;
		var pad = function (n) { return (n < 10 ? '0' : '') + n; };
		setInterval(function () {
			t += 1;
			tc.textContent = pad(Math.floor(t / 60) % 60) + ':' + pad(t % 60);
		}, 1000);
	}
	// Career timeline: place each job clip by its dates, move the playhead to today,
	// and link clips with their cards. Durations keep themselves up to date.
	var xpMonths = function (s) { var p = s.split('-'); return (+p[0]) * 12 + (+p[1] - 1); };
	var xpFmt = function (m) {
		var y = Math.floor(m / 12), r = m % 12, out = [];
		if (y) { out.push(y + (y === 1 ? ' yr' : ' yrs')); }
		if (r) { out.push(r + (r === 1 ? ' mo' : ' mos')); }
		return out.join(' ') || '1 mo';
	};
	var xpToday = new Date();
	var xpNow = xpToday.getFullYear() * 12 + xpToday.getMonth();
	document.querySelectorAll('.xp-panel').forEach(function (panel) {
		var tl = panel.querySelector('.xp-tl');
		var clips = [].slice.call(panel.querySelectorAll('.xp-clip'));
		var len = function (c) { return (c.dataset.end ? xpMonths(c.dataset.end) : xpNow) - xpMonths(c.dataset.start) + 1; };

		// Stats and the live duration of the current job
		var design = 0;
		clips.forEach(function (c) { if (c.hasAttribute('data-design')) { design += len(c); } });
		var d = panel.querySelector('[data-xp-design]');
		if (d && design) { d.textContent = Math.floor(design / 12) + '+'; }
		var cur = panel.querySelector('.xp-clip[data-current]');
		if (cur) {
			var cm = len(cur);
			var cs = panel.querySelector('[data-xp-current]'); if (cs) { cs.textContent = Math.floor(cm / 12) + '+'; }
			var cd = panel.querySelector('[data-xp-dur]'); if (cd) { cd.textContent = xpFmt(cm); }
		}
		if (!tl || !clips.length) { return; }

		var first = Math.min.apply(null, clips.map(function (c) { return xpMonths(c.dataset.start); }));
		var start = Math.floor(first / 12) * 12;
		var end = xpNow + 5;
		var span = end - start;
		var pct = function (m) { return (m - start) / span * 100; };
		var r = panel.querySelector('[data-xp-range]'); if (r) { r.textContent = start / 12; }
		clips.forEach(function (c) {
			var a = xpMonths(c.dataset.start), b = (c.dataset.end ? xpMonths(c.dataset.end) : xpNow) + 1;
			c.style.left = pct(a) + '%';
			c.style.width = (pct(b) - pct(a)) + '%';
			c.title = c.textContent.replace(/^\s*\S+\s*/, '');
		});
		var ruler = tl.querySelector('[data-xp-ruler]');
		var years = [];
		for (var y = start / 12; y * 12 <= xpNow; y++) {
			var mark = document.createElement('span'); mark.className = 'xp-year';
			mark.style.left = pct(y * 12) + '%';
			mark.dataset.y = y;
			ruler.appendChild(mark); years.push(mark);
		}
		var ph = tl.querySelector('[data-xp-ph]');
		var body = tl.querySelector('.xp-body');
		var layout = function () {
			var w = body.offsetWidth;
			clips.forEach(function (c) { c.classList.toggle('is-narrow', c.offsetWidth < 92); });
			var short = w / span * 12 < 46;
			years.forEach(function (m) { m.textContent = short ? '’' + String(m.dataset.y).slice(2) : m.dataset.y; });
			ruler.style.setProperty('--xp-month', Math.max(3, w / span) + 'px');
			tl.style.setProperty('--xp-start', body.offsetLeft + 'px');
			tl.style.setProperty('--xp-now', (body.offsetLeft + w * pct(xpNow + xpToday.getDate() / 31) / 100) + 'px');
		};
		layout();
		window.addEventListener('resize', layout);
		if ('IntersectionObserver' in window) {
			var seen = new IntersectionObserver(function (es) {
				es.forEach(function (e) { if (e.isIntersecting) { tl.classList.add('is-in'); seen.disconnect(); } });
			}, { threshold: 0.35 });
			seen.observe(tl);
		} else { tl.classList.add('is-in'); }

		clips.forEach(function (c) {
			var card = document.getElementById(c.dataset.target);
			if (!card) { return; }
			var on = function (v) { c.classList.toggle('is-on', v); card.classList.toggle('is-on', v); };
			c.addEventListener('mouseenter', function () { on(true); });
			c.addEventListener('mouseleave', function () { on(false); });
			card.addEventListener('mouseenter', function () { on(true); });
			card.addEventListener('mouseleave', function () { on(false); });
			c.addEventListener('click', function () {
				card.classList.remove('is-flash'); void card.offsetWidth; card.classList.add('is-flash');
				card.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
			});
		});
	});
})();
