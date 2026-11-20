import { describe, expect, it } from 'vitest';
import {
  classifyLink,
  cleanClarityId,
  cleanGa4Id,
  cookieDomains,
  isMeasurementCookie,
  placementOf,
  reportableUrl,
} from './consent-track';

describe('classifyLink', () => {
  it.each([
    ['tel:+84912345678', 'click_call', 'phone'],
    ['mailto:a@b.vn', 'click_email', 'email'],
    ['https://zalo.me/0912345678', 'click_zalo', 'zalo'],
    ['https://m.me/somepage', 'click_messenger', 'messenger'],
    ['https://www.messenger.com/t/x', 'click_messenger', 'messenger'],
    ['https://www.facebook.com/abc', 'click_social', 'facebook'],
    ['https://youtu.be/xyz', 'click_social', 'youtube'],
    ['https://www.youtube.com/@x', 'click_social', 'youtube'],
    ['https://www.tiktok.com/@abmdungtq', 'click_social', 'tiktok'],
  ])('%s → %s', (href, name, method) => {
    expect(classifyLink(href)).toEqual({ name, method });
  });

  it.each([
    'https://www.google.com/maps/search/?api=1&query=x',
    'https://maps.google.com/?q=x',
    'https://www.google.com.vn/maps/place/x',
    'https://maps.app.goo.gl/abc',
    'https://goo.gl/maps/abc',
  ])('counts %s as directions', (href) => {
    expect(classifyLink(href)).toEqual({ name: 'click_directions' });
  });

  it.each([
    '/bai-viet/x',
    'https://tqd.me/shop',
    'https://www.google.com/search?q=x',
    'https://goo.gl/abc',
    'https://github.com/x',
    'javascript:void(0)',
    '#top',
    '',
    null,
  ])('ignores %s', (href) => {
    expect(classifyLink(href)).toBeNull();
  });

  it('does not treat lookalike hosts as social', () => {
    expect(classifyLink('https://notfacebook.com/x')).toBeNull();
    expect(classifyLink('https://zalo.me.evil.io/x')).toBeNull();
  });
});

describe('reportableUrl', () => {
  it('never reports phone numbers or e-mail addresses', () => {
    expect(reportableUrl('tel:0912345678')).toBeUndefined();
    expect(reportableUrl('MAILTO:a@b.vn')).toBeUndefined();
  });
  it('strips query strings and fragments', () => {
    expect(reportableUrl('https://www.tiktok.com/@x?x=1#y')).toBe('https://www.tiktok.com/@x');
  });
  it('reports only the host of chat links, which carry a phone number or handle', () => {
    expect(reportableUrl('https://zalo.me/0912345678?x=1')).toBe('https://zalo.me');
    expect(reportableUrl('https://chat.zalo.me/0912345678')).toBe('https://chat.zalo.me');
    expect(reportableUrl('https://m.me/someone')).toBe('https://m.me');
    expect(reportableUrl('https://www.messenger.com/t/123')).toBe('https://www.messenger.com');
  });
});

describe('placementOf', () => {
  const inside = (...matching: string[]) => ({
    closest: (selector: string) => (matching.includes(selector) ? {} : null),
  });
  it('detects each page zone', () => {
    expect(placementOf(inside('header, .site-header'))).toBe('header');
    expect(placementOf(inside('footer, .site-footer'))).toBe('footer');
    expect(placementOf(inside('.hero, [data-placement="hero"]'))).toBe('hero');
    expect(placementOf(inside())).toBe('content');
    expect(placementOf(null)).toBe('content');
  });
  it('prefers header over hero when nested', () => {
    expect(placementOf(inside('header, .site-header', '.hero, [data-placement="hero"]'))).toBe('header');
  });
});

describe('measurement cookies', () => {
  it.each(['_ga', '_ga_Z9XEQ6BVXJ', '_gid', '_gat', '_gat_UA-1', '_clck', '_clsk'])('drops %s', (name) => {
    expect(isMeasurementCookie(name)).toBe(true);
  });
  it.each(['tqd_session', '_gads', 'gaming', '_clckx'])('keeps %s', (name) => {
    expect(isMeasurementCookie(name)).toBe(false);
  });
  it('lists the host and every parent domain', () => {
    expect(cookieDomains('tqd.me')).toEqual(['', '.tqd.me']);
    expect(cookieDomains('www.example.com.vn')).toEqual(['', '.www.example.com.vn', '.example.com.vn', '.com.vn']);
  });
});

describe('identifier validation', () => {
  it('accepts real ids and rejects anything else', () => {
    expect(cleanGa4Id('G-Z9XEQ6BVXJ')).toBe('G-Z9XEQ6BVXJ');
    expect(cleanGa4Id('UA-123')).toBe('');
    expect(cleanClarityId('zgki6l3y68')).toBe('zgki6l3y68');
    expect(cleanClarityId('bad id"><script>')).toBe('');
    expect(cleanClarityId(undefined)).toBe('');
  });
});
