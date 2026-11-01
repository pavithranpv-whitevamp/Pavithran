/* Mini Lion Galaxy — site script */
var MLG = {
  channelId: 'UC68V0u0qcaH_9tuQJs2MBhQ',
  channelUrl: 'https://www.youtube.com/@miniliongalaxy',
  // Contact email for the "Reach out" form. Leave empty to send people to YouTube instead.
  contactEmail: '',
  // Where the Explore page gets its video list: the Cloudflare function in
  // functions/mini_liongalaxy/videos.js (re-checks the channel every 15 minutes).
  // If it can't be reached, the page shows YouTube's own playlist player instead.
  feeds: ['/mini_liongalaxy/videos']
};

(function () {
  'use strict';

  /* ---------- Starfield ---------- */
  var sky = document.querySelector('.starfield');
  if (sky) {
    var count = window.innerWidth < 700 ? 60 : 120;
    for (var i = 0; i < count; i++) {
      var s = document.createElement('span');
      var size = Math.random() < 0.85 ? 2 : 3 + Math.random() * 2;
      s.className = 'star';
      s.style.width = s.style.height = size + 'px';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 3.5).toFixed(2) + 's';
      if (Math.random() < 0.12) s.style.background = Math.random() < 0.5 ? '#ffc72c' : '#3ec6f0';
      sky.appendChild(s);
    }
  }

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Year in footer ---------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Pop-in on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('shown'); });
  }

  /* ---------- Video player popup ---------- */
  var modal = document.querySelector('.player-modal');
  var frameBox = modal && modal.querySelector('.player-frame');
  var titleBox = modal && modal.querySelector('.player-title');
  var lastFocus = null;

  function openPlayer(id, title) {
    if (!modal) { window.open('https://www.youtube.com/watch?v=' + id, '_blank'); return; }
    lastFocus = document.activeElement;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    iframe.title = title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    frameBox.innerHTML = '';
    frameBox.appendChild(iframe);
    titleBox.textContent = title;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.player-close').focus();
  }
  function closePlayer() {
    if (!modal) return;
    modal.classList.remove('open');
    frameBox.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  if (modal) {
    modal.querySelector('.player-close').addEventListener('click', closePlayer);
    modal.addEventListener('click', function (e) { if (e.target === modal) closePlayer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePlayer(); });
  }

  /* ---------- Autopilot: videos from the YouTube channel ---------- */
  var grid = document.getElementById('video-grid');
  if (grid) loadVideos(grid);

  function loadVideos(grid) {
    var status = document.getElementById('video-status');
    var limit = parseInt(grid.getAttribute('data-limit') || '0', 10);

    function tryFeed(i) {
      if (i >= MLG.feeds.length) return Promise.reject(new Error('no feed'));
      return fetch(MLG.feeds[i], { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('feed'); return r.json(); })
        .then(function (data) {
          if (!data || !data.videos || !data.videos.length) throw new Error('empty');
          return data;
        })
        .catch(function () { return tryFeed(i + 1); });
    }

    tryFeed(0)
      .then(function (data) {
        var list = data.videos;
        if (limit) list = list.slice(0, limit);
        list.forEach(function (v) { grid.appendChild(videoCard(v)); });
        if (status) status.remove();
      })
      .catch(function () { showPlaylistFallback(grid, status); });
  }

  function videoCard(v) {
    var card = document.createElement('article');
    card.className = 'video-card';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Play: ' + v.title);
    btn.addEventListener('click', function () { openPlayer(v.id, v.title); });

    var thumb = document.createElement('div');
    thumb.className = 'video-thumb';
    var img = document.createElement('img');
    img.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg';
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
    var play = document.createElement('span');
    play.className = 'play-badge';
    thumb.appendChild(play);

    var published = v.published ? new Date(v.published) : null;
    if (published && (Date.now() - published.getTime()) < 7 * 864e5) {
      var nb = document.createElement('span');
      nb.className = 'new-badge';
      nb.textContent = 'NEW!';
      thumb.appendChild(nb);
    }

    var info = document.createElement('div');
    info.className = 'video-info';
    var h = document.createElement('h2');
    h.textContent = v.title;
    info.appendChild(h);
    var meta = document.createElement('div');
    meta.className = 'meta';
    var bits = [];
    if (published) bits.push(published.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
    if (v.views) bits.push(Number(v.views).toLocaleString() + ' views');
    meta.textContent = bits.join(' • ');
    info.appendChild(meta);

    btn.appendChild(thumb);
    btn.appendChild(info);
    card.appendChild(btn);
    return card;
  }

  // If the feed can't be read (e.g. a host without PHP), embed the channel's
  // uploads playlist, which YouTube keeps up to date by itself.
  function showPlaylistFallback(grid, status) {
    var box = document.createElement('div');
    box.className = 'playlist-embed';
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/videoseries?list=UU' + MLG.channelId.slice(2) + '&rel=0&modestbranding=1';
    iframe.title = 'Mini Lion Galaxy videos';
    iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    box.appendChild(iframe);
    grid.replaceWith(box);
    if (status) status.remove();
  }

  /* ---------- Reach out form ---------- */
  var form = document.getElementById('reach-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var f = form.elements;
      var body =
        'Name: ' + f.name.value + '\n' +
        'Email: ' + f.email.value + '\n' +
        'I am a: ' + f.who.value + '\n\n' +
        f.message.value;
      var note = document.getElementById('form-note');
      if (MLG.contactEmail) {
        window.location.href = 'mailto:' + MLG.contactEmail +
          '?subject=' + encodeURIComponent('Hello from ' + f.name.value + ' (' + f.topic.value + ')') +
          '&body=' + encodeURIComponent(body);
        if (note) note.textContent = 'Your email app is opening. Just press send! 🚀';
      } else {
        window.open(MLG.channelUrl, '_blank', 'noopener');
        if (note) note.textContent = 'Say hi in the comments on our YouTube channel! 🦁';
      }
    });
  }
})();
