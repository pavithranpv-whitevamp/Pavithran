// Receives the "Worked with me?" form from /recommend/ and saves it in the VAULT KV storage.
// New submissions show up in the admin page → Testimonials → "New from colleagues",
// where Pavithran can add them to the website or dismiss them. Nothing is published automatically.

const RELATIONS = ['Colleague', 'Teammate', 'Manager', 'Client', 'Mentor', 'Other'];
const clean = (s, max) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const back = (url, where) => Response.redirect(new URL(where, url).toString(), 303);

export async function onRequestPost({ request, env }) {
  const url = request.url;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(url).origin) return new Response('Blocked', { status: 403 });
  if (!env.VAULT) return back(url, '/recommend/?e=setup');

  const form = await request.formData().catch(() => null);
  if (!form) return back(url, '/recommend/?e=form');
  if (clean(form.get('website'), 200)) return back(url, '/thanks/?from=testimonial'); // spam trap filled in by bots

  const t = {
    name: clean(form.get('name'), 80),
    email: clean(form.get('email'), 120),
    role: clean(form.get('role'), 80),
    company: clean(form.get('company'), 100),
    relation: RELATIONS.find((r) => r === clean(form.get('relationship'), 20)) || 'Other',
    quote: clean(form.get('testimonial'), 1200),
    link: /^https:\/\/\S+$/i.test(clean(form.get('linkedin'), 300)) ? clean(form.get('linkedin'), 300) : '',
    ok: !!form.get('ok_to_publish'),
    at: new Date().toISOString(),
  };
  if (!t.name || !t.quote || !t.ok) return back(url, '/recommend/?e=missing');

  // Up to 5 submissions per hour from the same connection
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rk = 'rl:recommend:' + ip;
  const n = parseInt((await env.VAULT.get(rk)) || '0', 10);
  if (n >= 5) return back(url, '/recommend/?e=busy');
  await env.VAULT.put(rk, String(n + 1), { expirationTtl: 3600 });

  const id = Date.now().toString(36) + '-' + [...crypto.getRandomValues(new Uint8Array(6))].map((x) => x.toString(16).padStart(2, '0')).join('');
  await env.VAULT.put('tsub:' + id, JSON.stringify(t), { metadata: { name: t.name, at: t.at } });
  return back(url, '/thanks/?from=testimonial');
}

export async function onRequest() {
  return new Response('Use the form at /recommend/', { status: 405, headers: { Allow: 'POST' } });
}
