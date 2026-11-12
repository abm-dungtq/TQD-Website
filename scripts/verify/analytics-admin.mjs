#!/usr/bin/env node
/**
 * scripts/verify/analytics-admin.mjs
 * Nghiệm thu trực tiếp (Live Verification) cho https://tqd.me (AC1-AC3, AC5, AC10, AC11).
 */
import assert from 'node:assert/strict';

const base = (process.argv[2] || 'https://tqd.me').replace(/\/+$/, '');

async function main() {
  // 1. GET /quyen-rieng-tu -> 200
  const privacyRes = await fetch(`${base}/quyen-rieng-tu`);
  assert.equal(privacyRes.status, 200, `GET /quyen-rieng-tu status=${privacyRes.status}`);
  const privacyHtml = await privacyRes.text();
  assert.ok(privacyHtml.includes('dungtq.ceo@gmail.com'), '/quyen-rieng-tu missing contact email');
  assert.ok(privacyHtml.includes('tqd_notrack'), '/quyen-rieng-tu missing opt-out instruction');

  // 2. GET /admin/thong-ke without session cookie -> 303 redirect to /admin/login
  const adminRes = await fetch(`${base}/admin/thong-ke`, { redirect: 'manual' });
  assert.equal(adminRes.status, 303, `Unauthenticated GET /admin/thong-ke expected 303, got ${adminRes.status}`);
  const loc = adminRes.headers.get('location') || '';
  assert.ok(loc.includes('/admin/login'), `Expected redirect to /admin/login, got ${loc}`);

  // 3. POST /api/t valid payload -> 204, no set-cookie
  const validBeaconRes = await fetch(`${base}/api/t`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
    },
    body: JSON.stringify({
      e: 'page_view',
      p: '/',
      s: 'testsid1',
      pv: 'testpv1',
    }),
  });
  assert.equal(validBeaconRes.status, 204, `Valid POST /api/t expected 204, got ${validBeaconRes.status}`);
  assert.equal(validBeaconRes.headers.get('set-cookie'), null, 'POST /api/t must not set cookies');

  // 4. POST /api/t unknown key -> 400
  const invalidBeaconRes = await fetch(`${base}/api/t`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
    },
    body: JSON.stringify({
      e: 'page_view',
      p: '/',
      unknownKey: '123',
    }),
  });
  assert.equal(invalidBeaconRes.status, 400, `Invalid POST /api/t expected 400, got ${invalidBeaconRes.status}`);

  console.log(`OK: analytics-admin passed all checks on ${base}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
