// End-to-end admin check. Password comes from TQD_ADMIN_PASSWORD, never from argv.
// Usage: TQD_ADMIN_PASSWORD=... node scripts/verify/admin.mjs <base-url>
const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const password = (process.env.TQD_ADMIN_PASSWORD ?? '').trim();
const email = (process.env.TQD_ADMIN_EMAIL ?? 'dungtq.ceo@gmail.com').trim();
if (!password) {
  console.log('FAIL setup TQD_ADMIN_PASSWORD is empty');
  process.exit(1);
}

const fail = (step, detail) => {
  console.log(`FAIL ${step} ${detail}`);
  process.exit(1);
};

const request = (path, { method = 'GET', form, cookie, origin = base } = {}) => {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (method !== 'GET') headers.Origin = origin;
  if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  return fetch(base + path, { method, headers, body: form ? new URLSearchParams(form) : undefined, redirect: 'manual' });
};

// The astro dev proxy resets its workerd connection when the Worker answers a POST
// before the request body stream has ended; a short pause lets it recover.
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

const expect = (step, res, status) => {
  if (res.status !== status) fail(step, res.status);
};

// 1. Anonymous admin access redirects to login.
let res = await request('/admin');
expect(1, res, 303);
if (!(res.headers.get('location') ?? '').endsWith('/admin/login')) fail(1, res.headers.get('location'));

// 1b. Encoded, doubled-slash or upper-case paths must not slip past the session check.
for (const path of ['/%61dmin/api/settings/person', '//admin/api/settings/person', '/ADMIN/api/settings/person']) {
  res = await request(path);
  if (res.status === 200) fail('1b', `${path} 200`);
}
res = await request('/%61dmin/ho-so', { method: 'POST', form: { role: 'bypass' } });
await settle();
if (res.status === 200 || res.status === 303) fail('1b', `POST /%61dmin/ho-so ${res.status}`);

// 2. Correct login sets the session cookie.
res = await request('/admin/login', { method: 'POST', form: { email, password } });
expect(2, res, 303);
const sessionCookie = res.headers.getSetCookie().find((c) => c.startsWith('__Host-tqd_admin='));
if (!sessionCookie) fail(2, 'no session cookie');
const cookie = sessionCookie.split(';')[0];

// 3. Read the current profile.
res = await request('/admin/api/settings/person', { cookie });
expect(3, res, 200);
const person = await res.json();
const profileForm = (role) => ({
  name: person.name,
  handle: person.handle,
  initials: person.initials,
  role,
  intro: person.intro,
  focus: person.focus.join('\n'),
  email: person.email,
  zalo: person.zalo,
  portraitAlt: person.portraitAlt,
});

// 4-6 change the live profile, so 7 restores it even when one of them fails.
const marker = `Kiểm thử ${Date.now()}`;
let failure;
try {
  // 4. An edit shows up on the public page.
  res = await request('/admin/ho-so', { method: 'POST', form: profileForm(marker), cookie });
  if (res.status !== 303) throw [4, res.status];
  if (!(await (await request('/')).text()).includes(marker)) throw [4, 'marker missing on /'];

  // 5. Cross-origin writes are refused.
  res = await request('/admin/ho-so', { method: 'POST', form: profileForm('evil'), cookie, origin: 'https://evil.example' });
  await settle();
  if (res.status !== 403) throw [5, res.status];

  // 6. Writes without a session are refused.
  res = await request('/admin/ho-so', { method: 'POST', form: profileForm('anon') });
  await settle();
  if (res.status !== 401) throw [6, res.status];
} catch (e) {
  failure = e;
}

// 7. Restore the original role.
res = await request('/admin/ho-so', { method: 'POST', form: profileForm(person.role), cookie });
if (failure) fail(...(Array.isArray(failure) ? failure : ['4-6', failure]));
expect(7, res, 303);
if ((await (await request('/')).text()).includes(marker)) fail(7, 'marker still on /');

// 8. Logout invalidates the session.
res = await request('/admin/logout', { method: 'POST', cookie });
expect(8, res, 303);
res = await request('/admin', { cookie });
expect(8, res, 303);
if (!(res.headers.get('location') ?? '').endsWith('/admin/login')) fail(8, res.headers.get('location'));

// 9. Five wrong passwords lock the login, even for the right one.
for (let i = 0; i < 5; i += 1) {
  res = await request('/admin/login', { method: 'POST', form: { email, password: `wrong-${i}-${password}` } });
  expect(`9.${i + 1}`, res, 401);
}
res = await request('/admin/login', { method: 'POST', form: { email, password } });
expect('9.6', res, 429);

console.log('OK admin');
