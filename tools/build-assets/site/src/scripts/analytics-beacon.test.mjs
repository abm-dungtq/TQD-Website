import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = ts.transpile(readFileSync('src/scripts/analytics-beacon.ts', 'utf8'), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
});

function beacon() {
  let now = 1_000_000;
  const events = {};
  const sent = [];
  const storage = new Map();
  const document = { visibilityState: 'visible', referrer: '', querySelector: () => null,
    querySelectorAll: () => [], addEventListener: (name, cb) => { events[`d:${name}`] = cb; } };
  vm.runInNewContext(source, { document,
    window: { addEventListener: (name, cb) => { events[`w:${name}`] = cb; } },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    navigator: { webdriver: false, sendBeacon: (_, blob) => { sent.push(blob); return true; } },
    location: { pathname: '/', search: '' }, Date: { now: () => now }, Math, URLSearchParams, Blob,
    fetch: async () => ({}),
  });
  return {
    advance: ms => { now += ms; },
    act: () => events['w:pointerdown'](),
    visibility: state => { document.visibilityState = state; events['d:visibilitychange'](); },
    hide: () => events['w:pagehide'](),
    payloads: () => Promise.all(sent.map(async b => JSON.parse(await b.text()))),
  };
}

describe('engagement beacon idle accounting', () => {
  it.each([[20_000, 20_000], [31_000, 30_000], [120_000, 30_000]])(
    'preserves time before the idle deadline when leaving after %i ms', async (elapsed, expected) => {
      const page = beacon();
      page.advance(elapsed);
      page.visibility('hidden');
      page.hide();
      expect((await page.payloads()).map(p => p.ms)).toEqual([expected]);
    });

  it('does not count hidden time or duplicate a previous flush after resuming', async () => {
    const page = beacon();
    page.advance(31_000);
    page.visibility('hidden');
    page.advance(120_000);
    page.visibility('visible');
    page.advance(10_000);
    page.visibility('hidden');
    expect((await page.payloads()).map(p => p.ms)).toEqual([30_000, 10_000]);
  });

  it('preserves the pre-idle interval when activity resumes without changing tabs', async () => {
    const page = beacon();
    page.advance(60_000);
    page.act();
    page.advance(5_000);
    page.hide();
    page.advance(40_000);
    page.hide();
    expect((await page.payloads()).map(p => p.ms)).toEqual([35_000, 25_000]);
  });
});
