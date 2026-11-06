/*
  Floating WhatsApp button + "Ask about Pavithran" recruiter assistant.
  The assistant is a simple, free, no-server helper: it matches what the visitor asks
  against the answers below (taken from Pavithran's CV and this website).
  To change an answer, edit the ANSWERS list. To change the WhatsApp number, edit WA_NUMBER.
*/
(function () {
	'use strict';

	var WA_NUMBER = '918940383773'; // +91 89403 83773 (country code + number, digits only)
	var EMAIL = 'Pavithranwv@gmail.com';
	var PHONES = ['+91 74022 76130', '+91 89403 83773'];

	// ---------- facts used in several answers ----------
	var JOBS = [
		{ title: 'Computer Service Engineer', company: 'Micro Computers', from: '2021-12', to: '2022-05' },
		{ title: 'Video & Graphic Designer (YouTube)', company: 'Village Food Factory', from: '2022-07', to: '2022-12', design: true },
		{ title: 'Graphic Designer & Motion Graphics Video Editor', company: 'Impressive Innovations and Solutions Pvt. Ltd.', from: '2023-05', design: true }
	];
	var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	var today = new Date();
	var nowM = today.getFullYear() * 12 + today.getMonth();
	var ym = function (s) { var p = s.split('-'); return (+p[0]) * 12 + (+p[1] - 1); };
	var span = function (j) { return (j.to ? ym(j.to) : nowM) - ym(j.from) + 1; };
	var label = function (s) { var m = ym(s); return MONTHS[m % 12] + ' ' + Math.floor(m / 12); };
	var dur = function (m) {
		var y = Math.floor(m / 12), r = m % 12, o = [];
		if (y) { o.push(y + (y === 1 ? ' yr' : ' yrs')); }
		if (r) { o.push(r + (r === 1 ? ' mo' : ' mos')); }
		return o.join(' ') || '1 mo';
	};
	var designYears = Math.floor(JOBS.filter(function (j) { return j.design; }).reduce(function (a, j) { return a + span(j); }, 0) / 12);
	var current = JOBS[JOBS.length - 1];

	var wa = function (text) { return 'https://wa.me/' + WA_NUMBER + (text ? '?text=' + encodeURIComponent(text) : ''); };
	var WA_HIRE = 'Hi Pavithran, I found your portfolio website and I’d like to talk about an opportunity.';
	var WA_CV = 'Hi Pavithran, I visited your portfolio website. Could you please share your latest CV?';

	// Quick-reply buttons. kind: "ask" (asks the assistant) or "link".
	var C = {
		exp: { t: 'Work experience', ask: 'experience' },
		skills: { t: 'Skills & tools', ask: 'skills' },
		avail: { t: 'Is he available?', ask: 'available' },
		work: { t: 'See his work', ask: 'portfolio' },
		edu: { t: 'Education', ask: 'education' },
		contact: { t: 'Contact him', ask: 'contact' },
		services: { t: 'What can he do?', ask: 'services' },
		cv: { t: 'Get his CV', ask: 'cv' },
		lang: { t: 'Languages', ask: 'languages' },
		where: { t: 'Location', ask: 'location' },
		waHire: { t: 'Chat on WhatsApp', href: wa(WA_HIRE), wa: true },
		waCv: { t: 'Ask for CV on WhatsApp', href: wa(WA_CV), wa: true },
		mail: { t: 'Send an email', href: 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Opportunity for Pavithran') },
		form: { t: 'Contact form', href: '/contact/' },
		portfolio: { t: 'Open portfolio', href: '/portfolio/', gold: true },
		about: { t: 'About page', href: '/about-me/' }
	};

	// ---------- answers ----------
	// keys: words/phrases that point to this answer (lowercase). The best match wins.
	var ANSWERS = [
		{
			id: 'experience',
			keys: ['experience', 'exp', 'work history', 'worked', 'career', 'job', 'jobs', 'previous', 'past', 'company', 'companies', 'employer', 'years', 'how long', 'background', 'resume history', 'roles'],
			html: function () {
				return '<p>Pavithran has <b>' + designYears + '+ years in design &amp; video</b> across 3 full-time roles, all in Tirupur:</p><ul>' +
					JOBS.slice().reverse().map(function (j) {
						return '<li><b>' + esc(j.title) + '</b><br>' + esc(j.company) + '<br><span class="muted">' + label(j.from) + ' – ' + (j.to ? label(j.to) : 'Present') + ' · ' + dur(span(j)) + '</span></li>';
					}).join('') + '</ul>';
			},
			chips: ['skills', 'avail', 'cv']
		},
		{
			id: 'current',
			keys: ['current', 'currently', 'now working', 'present', 'where does he work', 'working now', 'impressive', 'notice period', 'notice'],
			html: function (q) {
				var t = '<p>He currently works full-time as a <b>' + esc(current.title) + '</b> at <b>' + esc(current.company) + '</b>, Tirupur — since ' + label(current.from) + ' (' + dur(span(current)) + ').</p>';
				if (/notice/.test(q)) { t += '<p>For his notice period, it’s best to ask him directly — he usually replies quickly on WhatsApp.</p>'; }
				return t;
			},
			chips: ['exp', 'avail', 'waHire']
		},
		{
			id: 'skills',
			keys: ['skill', 'skills', 'tool', 'tools', 'software', 'photoshop', 'illustrator', 'premiere', 'after effects', 'aftereffects', 'davinci', 'resolve', 'blender', 'wordpress', 'elementor', 'adobe', 'proficient', 'expert', 'good at', 'know', '3d'],
			html: function () {
				return '<p>Tools he works with:</p><ul>' +
					'<li><b>Proficient:</b> Adobe Photoshop, Illustrator, Premiere Pro, After Effects</li>' +
					'<li><b>Intermediate:</b> WordPress with Elementor (building &amp; managing websites, no coding)</li>' +
					'<li><b>Learning:</b> DaVinci Resolve, Blender</li></ul>' +
					'<p class="muted">He also has a background in computer hardware &amp; networking.</p>';
			},
			chips: ['services', 'work', 'exp']
		},
		{
			id: 'services',
			keys: ['service', 'services', 'what can', 'what does', 'do for', 'offer', 'design', 'poster', 'posters', 'flyer', 'brochure', 'business card', 'branding', 'logo', 'print', 'motion', 'motion graphics', 'animation', 'video', 'editing', 'edit', 'reels', 'reel', 'youtube', 'social media', 'lower thirds', 'thumbnail'],
			html: function () {
				return '<p>He covers design, motion and video under one roof:</p><ul>' +
					'<li><b>Graphic design</b> — posters, flyers, brochures, business cards and print-ready designs</li>' +
					'<li><b>Motion graphics</b> — social media reels, lower thirds and motion content for brands</li>' +
					'<li><b>Video editing</b> — reels, brand videos, social media edits and YouTube content</li></ul>';
			},
			chips: ['work', 'avail', 'waHire']
		},
		{
			id: 'available',
			keys: ['available', 'availability', 'open to work', 'hire', 'hiring', 'job opening', 'vacancy', 'opportunity', 'full time', 'full-time', 'fulltime', 'freelance', 'part time', 'part-time', 'contract', 'collaborat', 'interested', 'looking for', 'join', 'onboard', 'interview', 'when can'],
			html: function () {
				return '<p><b>Yes — he’s open to work.</b> He’s actively looking for <b>full-time roles</b>, <b>freelance projects</b> and <b>creative collaborations</b>.</p><p>The fastest way to set up a call or interview is WhatsApp.</p>';
			},
			chips: ['waHire', 'mail', 'exp']
		},
		{
			id: 'portfolio',
			keys: ['portfolio', 'work samples', 'samples', 'examples', 'projects', 'project', 'see his work', 'show', 'showreel', 'previous work', 'his work'],
			html: function () {
				return '<p>His work is on the <a href="/portfolio/">Portfolio page</a> — social media posters, theatre ads, brand ads, event invitations and reels. You can filter by category, and each project opens with its images and videos.</p>';
			},
			chips: ['portfolio', 'services', 'contact']
		},
		{
			id: 'education',
			keys: ['education', 'qualification', 'qualified', 'degree', 'study', 'studied', 'college', 'university', 'diploma', 'bca', 'school', 'sslc', 'graduate', 'graduation'],
			html: function () {
				return '<ul>' +
					'<li><b>Bachelor of Computer Applications</b><br>Alagappa University (Distance Education) <span class="muted">· 2022 – 2025</span></li>' +
					'<li><b>Diploma in Computer Engineering</b><br>Konghu Velalar Polytechnic College, Perundurai <span class="muted">· 2017 – 2020</span></li>' +
					'<li><b>SSLC</b><br>Bishop Ubagaraswamy Hr Sec School, Tirupur <span class="muted">· 2015 – 2017</span></li></ul>';
			},
			chips: ['exp', 'skills', 'cv']
		},
		{
			id: 'cv',
			keys: ['cv', 'resume', 'résumé', 'biodata', 'curriculum'],
			html: function () {
				return '<p>He’ll send you his latest CV directly. Tap below to ask on WhatsApp, or email him at <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.</p>';
			},
			chips: ['waCv', 'mail', 'exp']
		},
		{
			id: 'contact',
			keys: ['contact', 'reach', 'email', 'mail', 'phone', 'number', 'call', 'whatsapp', 'message', 'talk', 'connect', 'get in touch', 'linkedin', 'instagram'],
			html: function () {
				return '<ul><li><b>WhatsApp:</b> <a href="' + wa(WA_HIRE) + '" target="_blank" rel="noopener">' + PHONES[1] + '</a></li>' +
					'<li><b>Phone:</b> ' + PHONES.map(function (p) { return '<a href="tel:' + p.replace(/\s/g, '') + '">' + p + '</a>'; }).join(', ') + '</li>' +
					'<li><b>Email:</b> <a href="mailto:' + EMAIL + '">' + EMAIL + '</a></li>' +
					'<li><b>LinkedIn:</b> <a href="https://www.linkedin.com/in/pavithran-e-wv9465445/" target="_blank" rel="noopener">Pavithran E</a></li></ul>';
			},
			chips: ['waHire', 'form', 'avail']
		},
		{
			id: 'location',
			keys: ['location', 'located', 'where', 'based', 'city', 'tirupur', 'tamil nadu', 'relocate', 'relocation', 'remote', 'onsite', 'on-site', 'office', 'wfh', 'work from home', 'hybrid', 'chennai', 'coimbatore', 'bangalore', 'bengaluru'],
			html: function (q) {
				var t = '<p>He’s based in <b>Tirupur, Tamil Nadu, India</b>.</p>';
				if (/remote|relocat|onsite|on-site|office|wfh|home|hybrid|chennai|coimbatore|bangalore|bengaluru/.test(q)) {
					t += '<p>For remote, hybrid or relocation questions, please check with him directly — he can confirm what works.</p>';
				}
				return t;
			},
			chips: ['waHire', 'avail', 'contact']
		},
		{
			id: 'languages',
			keys: ['language', 'languages', 'english', 'tamil', 'speak', 'communication', 'hindi'],
			html: function () { return '<ul><li><b>Tamil</b> — native</li><li><b>English</b> — intermediate (read, write, speak)</li></ul>'; },
			chips: ['exp', 'where', 'contact']
		},
		{
			id: 'pay',
			keys: ['salary', 'ctc', 'expected', 'expectation', 'pay', 'package', 'rate', 'rates', 'price', 'pricing', 'cost', 'charge', 'budget', 'quote', 'fees', 'lpa'],
			html: function () { return '<p>Salary and project rates depend on the role or brief, so he prefers to discuss them directly. Send him the details on WhatsApp or by email and he’ll get back to you.</p>'; },
			chips: ['waHire', 'mail', 'services']
		},
		{
			id: 'about',
			keys: ['who is', 'about him', 'about pavithran', 'tell me about', 'introduce', 'summary', 'profile', 'overview', 'pavithran'],
			html: function () {
				return '<p><b>Pavithran E</b> is a Graphic Designer and Motion Graphics Video Editor from Tirupur with <b>' + designYears + '+ years</b> in design &amp; video. He’s currently at ' + esc(current.company) + ' and is open to full-time roles, freelance work and collaborations.</p>';
			},
			chips: ['exp', 'skills', 'work']
		},
		{
			id: 'bot',
			keys: ['are you a bot', 'are you human', 'who are you', 'what are you', 'real person', 'ai'],
			html: function () { return '<p>I’m an automated assistant with answers from Pavithran’s CV and website. For anything I can’t answer, he’s one tap away on WhatsApp.</p>'; },
			chips: ['waHire', 'exp', 'skills']
		},
		{
			id: 'thanks',
			keys: ['thanks', 'thank you', 'thx', 'great', 'ok', 'okay', 'cool', 'bye', 'nice'],
			html: function () { return '<p>You’re welcome! If you’d like to take things forward, he’s easiest to reach on WhatsApp.</p>'; },
			chips: ['waHire', 'mail']
		},
		{
			id: 'hello',
			keys: ['hi', 'hello', 'hey', 'hii', 'good morning', 'good evening', 'vanakkam'],
			html: function () { return '<p>Hi! What would you like to know about Pavithran?</p>'; },
			chips: ['exp', 'skills', 'avail', 'work']
		}
	];
	var FALLBACK = {
		html: function () { return '<p>I don’t have an answer for that one, but Pavithran can tell you himself — he usually replies quickly on WhatsApp.</p><p class="muted">You can also ask me about his experience, skills, availability, education or work.</p>'; },
		chips: ['waHire', 'exp', 'skills', 'avail']
	};

	function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

	function match(text) {
		var q = ' ' + text.toLowerCase().replace(/[^a-z0-9+\s'-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
		var best = null, bestScore = 0;
		ANSWERS.forEach(function (a) {
			var score = 0;
			a.keys.forEach(function (k) {
				// short keys must match a whole word; longer ones can match part of a word
				var hit = k.length <= 3 ? q.indexOf(' ' + k + ' ') !== -1 : q.indexOf(k) !== -1;
				if (hit) { score += k.length > 6 ? 3 : 2; }
			});
			// greetings / thanks only win when nothing else matched
			if ((a.id === 'hello' || a.id === 'thanks') && score) { score = 0.5; }
			if (score > bestScore) { bestScore = score; best = a; }
		});
		return { a: best || FALLBACK, q: q };
	}

	// ---------- build the floating buttons ----------
	var WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.81-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.44 9.44zm8.04-17.48A11.3 11.3 0 0 0 12.04.7C5.77.7.67 5.8.67 12.06c0 2 .52 3.96 1.52 5.68L.57 23.7l6.1-1.6a11.34 11.34 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.36-11.37 0-3.04-1.18-5.89-3.33-8.04z"/></svg>';
	var SEND_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

	var fl = document.createElement('div');
	fl.className = 'fl';
	fl.innerHTML =
		'<a class="fl-wa" href="' + wa(WA_HIRE) + '" target="_blank" rel="noopener" aria-label="Chat with Pavithran on WhatsApp">' + WA_ICON + '<span class="fl-tip">Chat on WhatsApp</span></a>' +
		'<button class="fl-chat" type="button" aria-expanded="false" aria-controls="ch"><span class="av" aria-hidden="true"></span><span class="lbl">Hiring? Ask me</span><span class="x" aria-hidden="true">&times;</span></button>';

	var ch = document.createElement('section');
	ch.className = 'ch'; ch.id = 'ch'; ch.hidden = true;
	ch.setAttribute('role', 'dialog'); ch.setAttribute('aria-label', 'Ask about Pavithran');
	ch.innerHTML =
		'<div class="ch-head"><span class="av" aria-hidden="true"></span><div><b>Ask about Pavithran</b><small>Instant answers from his CV</small></div><span class="sp"></span><button class="ch-close" type="button" aria-label="Close chat">&times;</button></div>' +
		'<div class="ch-log" aria-live="polite"></div>' +
		'<form class="ch-form" autocomplete="off"><label class="screen-reader-text" for="ch-in">Type your question</label><input id="ch-in" type="text" maxlength="200" placeholder="Ask about experience, skills…"><button type="submit" aria-label="Send">' + SEND_ICON + '</button></form>' +
		'<div class="ch-note">Automated assistant · For anything else, WhatsApp Pavithran</div>';

	document.body.appendChild(ch);
	document.body.appendChild(fl);

	var btn = fl.querySelector('.fl-chat');
	var log = ch.querySelector('.ch-log');
	var input = ch.querySelector('#ch-in');
	var started = false;
	var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function scroll() { log.scrollTop = log.scrollHeight; }
	function add(cls, html) {
		var m = document.createElement('div');
		m.className = 'ch-msg ' + cls;
		m.innerHTML = html;
		log.appendChild(m); scroll();
		return m;
	}
	function chips(list) {
		var row = document.createElement('div');
		row.className = 'ch-chips';
		list.forEach(function (key) {
			var c = C[key]; if (!c) { return; }
			var el;
			if (c.href) {
				el = document.createElement('a'); el.href = c.href;
				if (/^https?:/.test(c.href)) { el.target = '_blank'; el.rel = 'noopener'; }
			} else {
				el = document.createElement('button'); el.type = 'button';
				el.addEventListener('click', function () { ask(c.t, c.ask); });
			}
			el.className = 'ch-chip' + (c.wa ? ' ch-chip--wa' : '') + (c.gold ? ' ch-chip--gold' : '');
			el.textContent = c.t;
			row.appendChild(el);
		});
		log.appendChild(row); scroll();
	}
	function reply(a, q) {
		var t = document.createElement('div');
		t.className = 'ch-msg ch-bot ch-typing'; t.innerHTML = '<i></i><i></i><i></i>';
		log.appendChild(t); scroll();
		setTimeout(function () {
			t.remove();
			add('ch-bot', a.html(q || ''));
			if (a.chips) { chips(a.chips); }
		}, calm ? 0 : 550);
	}
	function ask(text, forced) {
		// remove old quick replies so the log stays tidy
		[].forEach.call(log.querySelectorAll('.ch-chips'), function (r) { r.remove(); });
		add('ch-me', esc(text));
		var m = match(forced || text);
		reply(m.a, m.q);
	}
	function start() {
		if (started) { return; }
		started = true;
		add('ch-bot', '<p>Hi! 👋 I’m Pavithran’s assistant.</p><p>Hiring a <b>graphic designer</b> or <b>video editor</b>? Ask me about his experience, skills or availability — or tap a question below.</p>');
		chips(['exp', 'skills', 'avail', 'work', 'edu', 'cv', 'contact']);
	}
	function open(v) {
		ch.hidden = !v;
		btn.setAttribute('aria-expanded', String(v));
		fl.classList.toggle('is-open', v);
		btn.setAttribute('aria-label', v ? 'Close chat' : 'Open chat: ask about Pavithran');
		var n = fl.querySelector('.fl-nudge'); if (n) { n.remove(); }
		if (v) {
			start();
			try { sessionStorage.setItem('pvChatSeen', '1'); } catch (e) {}
			if (window.matchMedia('(hover: hover)').matches) { setTimeout(function () { input.focus(); }, 50); }
		} else { btn.focus(); }
	}
	btn.setAttribute('aria-label', 'Open chat: ask about Pavithran');
	btn.addEventListener('click', function () { open(ch.hidden); });
	ch.querySelector('.ch-close').addEventListener('click', function () { open(false); });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ch.hidden) { open(false); } });
	ch.querySelector('form').addEventListener('submit', function (e) {
		e.preventDefault();
		var v = input.value.trim();
		if (!v) { return; }
		input.value = '';
		ask(v);
	});

	// A small one-time hint bubble, a few seconds after the first page of a visit
	var seen = false;
	try { seen = !!sessionStorage.getItem('pvChatSeen'); } catch (e) {}
	if (!seen) {
		setTimeout(function () {
			if (!ch.hidden || fl.querySelector('.fl-nudge')) { return; }
			var n = document.createElement('div');
			n.className = 'fl-nudge';
			n.textContent = 'Recruiter? I can answer questions about Pavithran’s experience.';
			n.addEventListener('click', function () { open(true); });
			btn.parentNode.insertBefore(n, btn);
			try { sessionStorage.setItem('pvChatSeen', '1'); } catch (e) {}
			setTimeout(function () { if (n.parentNode) { n.remove(); } }, 9000);
		}, 6000);
	}
})();
