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

	// Portfolio category filter (all projects stay visible if JavaScript is off)
	var buttons = document.querySelectorAll('[data-filter]');
	var cards = document.querySelectorAll('.work-grid [data-cats]');
	buttons.forEach(function (btn) {
		btn.addEventListener('click', function () {
			var f = btn.getAttribute('data-filter');
			buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
			var label = btn.textContent;
			cards.forEach(function (c) {
				var list = (c.getAttribute('data-cats') || '').split(' ');
				c.hidden = !(f === 'all' || list.indexOf(f) !== -1);
				if (!c.hidden) { c.classList.add('is-in'); }
				// The tag shows the category you're looking at; "All" shows the main one.
				var tag = c.querySelector('.card-cat');
				if (tag) { tag.textContent = f === 'all' ? (c.getAttribute('data-main') || tag.textContent) : label; }
			});
		});
	});

	// Project images: click to view large, with previous/next and Esc to close
	var shots = Array.prototype.slice.call(document.querySelectorAll('.entry img'));
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
})();
