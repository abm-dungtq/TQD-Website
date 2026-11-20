// Pure helpers behind the opt-in measurement in src/scripts/consent.ts: which clicks count as an event,
// where on the page they happened, and which cookies to drop when the visitor withdraws consent.

export type TrackedEvent = {
  name:
    | 'click_call'
    | 'click_email'
    | 'click_zalo'
    | 'click_messenger'
    | 'click_directions'
    | 'click_social'
    | 'audio_play';
  method?: string;
};

export type Placement = 'header' | 'hero' | 'content' | 'footer';

const CLARITY_ID_RE = /^[a-z0-9]{6,16}$/;
const GA4_ID_RE = /^G-[A-Z0-9]{4,20}$/;

export const cleanGa4Id = (raw: string | undefined | null): string => {
  const id = String(raw ?? '').trim().toUpperCase();
  return GA4_ID_RE.test(id) ? id : '';
};

export const cleanClarityId = (raw: string | undefined | null): string => {
  const id = String(raw ?? '').trim().toLowerCase();
  return CLARITY_ID_RE.test(id) ? id : '';
};

/** Maps a link's raw href to the event it stands for, or null when the click is not measured. */
export function classifyLink(href: string | null | undefined): TrackedEvent | null {
  const lower = String(href ?? '').trim().toLowerCase();
  if (!lower) return null;
  if (lower.startsWith('tel:')) return { name: 'click_call', method: 'phone' };
  if (lower.startsWith('mailto:')) return { name: 'click_email', method: 'email' };

  const match = /^(?:https?:)?\/\/([^/?#]+)([^?#]*)/.exec(lower);
  if (!match) return null;
  const host = match[1].replace(/^www\./, '').replace(/:\d+$/, '');
  const path = match[2] || '/';

  if (host === 'zalo.me' || host === 'chat.zalo.me') return { name: 'click_zalo', method: 'zalo' };
  if (host === 'm.me' || host === 'messenger.com') return { name: 'click_messenger', method: 'messenger' };
  if (
    host === 'maps.app.goo.gl' ||
    (host === 'goo.gl' && path.startsWith('/maps')) ||
    (/^(maps\.)?google\.[a-z.]+$/.test(host) && (host.startsWith('maps.') || path.startsWith('/maps')))
  ) {
    return { name: 'click_directions' };
  }
  if (/(^|\.)facebook\.com$/.test(host) || host === 'fb.com') return { name: 'click_social', method: 'facebook' };
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return { name: 'click_social', method: 'youtube' };
  if (/(^|\.)tiktok\.com$/.test(host)) return { name: 'click_social', method: 'tiktok' };
  return null;
}

/**
 * The link target worth reporting: phone numbers and e-mail addresses never leave the page, nor do query strings.
 * Zalo and Messenger paths are a phone number or a personal handle, so only their host is reported.
 */
export function reportableUrl(href: string | null | undefined): string | undefined {
  const raw = String(href ?? '').trim();
  if (!raw || /^(tel|mailto):/i.test(raw)) return undefined;
  const bare = raw.split(/[?#]/)[0];
  const chat = /^(https?:\/\/(?:www\.)?(?:chat\.)?(?:zalo\.me|m\.me|messenger\.com))(?:[/:]|$)/i.exec(bare);
  return chat ? chat[1].toLowerCase() : bare;
}

type Closest = { closest(selector: string): unknown };

/** Where on the page an element sits, so reports can split header, hero, body and footer clicks. */
export function placementOf(el: Closest | null | undefined): Placement {
  if (!el || typeof el.closest !== 'function') return 'content';
  if (el.closest('header, .site-header')) return 'header';
  if (el.closest('footer, .site-footer')) return 'footer';
  if (el.closest('.hero, [data-placement="hero"]')) return 'hero';
  return 'content';
}

/** Cookies set by Google Analytics and Microsoft Clarity. */
export const isMeasurementCookie = (name: string): boolean => /^(_ga($|_)|_gid$|_gat|_clck$|_clsk$)/.test(name);

/**
 * Every domain a cookie for this host may sit on: host-only first, then each parent domain.
 * "www.example.com.vn" gives "", .www.example.com.vn, .example.com.vn, .com.vn; browsers ignore public suffixes.
 */
export function cookieDomains(host: string): string[] {
  const parts = host.split('.').filter(Boolean);
  const domains = [''];
  for (let i = 0; i <= parts.length - 2; i += 1) domains.push(`.${parts.slice(i).join('.')}`);
  return domains;
}
