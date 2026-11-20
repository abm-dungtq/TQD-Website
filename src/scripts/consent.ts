// Google Analytics 4 and Microsoft Clarity behind an explicit opt-in: nothing is requested from Google or
// Microsoft and no measurement cookie is set until the visitor accepts. The choice is stored in localStorage
// and can be changed from the footer or on /quyen-rieng-tu.
import {
  classifyLink,
  cleanClarityId,
  cleanGa4Id,
  cookieDomains,
  isMeasurementCookie,
  placementOf,
  reportableUrl,
  type TrackedEvent,
} from '../lib/consent-track';

declare global {
  interface Window {
    dataLayer?: unknown[];
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

type Choice = 'granted' | 'denied';

const CHOICE_KEY = 'tqd_consent';
const root = document.documentElement.dataset;
const ga4Id = cleanGa4Id(root.ga4);
const clarityId = cleanClarityId(root.clarity);
const flags = window as unknown as Record<string, boolean>;

const readChoice = (): Choice | null => {
  try {
    const value = localStorage.getItem(CHOICE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
};

const storeChoice = (choice: Choice) => {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
};

/** The existing first-party opt-out switch also turns third-party measurement off. */
const hasOptedOut = (): boolean => {
  try {
    return localStorage.getItem('tqd_notrack') === '1';
  } catch {
    return false;
  }
};

// gtag.js only understands the `arguments` object, not a plain array.
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

const addScript = (src: string) => {
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = src;
  document.head.appendChild(tag);
};

// Clarity gets analytics consent only; advertising storage stays denied.
const clarityConsent = (analytics: Choice) =>
  window.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: analytics });

let loaded = false;
let granted = false;

function loadGa4() {
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', ga4Id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
}

// Clarity records clicks, scrolling and mouse movement for heatmaps and session replays.
// Its default masking hides everything typed into form fields.
function loadClarity() {
  if (!window.clarity) {
    const queue = function (...args: unknown[]) {
      (queue.q ??= []).push(args);
    } as NonNullable<Window['clarity']>;
    window.clarity = queue;
    addScript(`https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`);
  }
  clarityConsent('granted');
}

function startMeasuring() {
  granted = true;
  if (ga4Id) flags[`ga-disable-${ga4Id}`] = false;
  if (loaded) {
    if (ga4Id) gtag('consent', 'update', { analytics_storage: 'granted' });
    if (clarityId) clarityConsent('granted');
    return;
  }
  loaded = true;
  if (ga4Id) loadGa4();
  if (clarityId) loadClarity();
}

function stopMeasuring() {
  granted = false;
  if (ga4Id) {
    flags[`ga-disable-${ga4Id}`] = true;
    if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  if (clarityId) clarityConsent('denied');
  const domains = cookieDomains(location.hostname);
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim();
    if (!isMeasurementCookie(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

function sendEvent(event: TrackedEvent, el: Element, href?: string) {
  if (!granted) return;
  if (ga4Id) {
    const params: Record<string, string> = { placement: placementOf(el), link_page: location.pathname, transport_type: 'beacon' };
    if (event.method) params.method = event.method;
    const url = reportableUrl(href);
    if (url) params.link_url = url;
    gtag('event', event.name, params);
    // Earlier reports count contact intent as generate_lead; keep that series unbroken.
    if (event.method === 'phone' || event.method === 'email' || event.method === 'zalo') {
      gtag('event', 'generate_lead', { method: event.method, link_page: location.pathname });
    }
  }
  // The same name tags the Clarity recording, so heatmaps and replays can be filtered by it.
  if (clarityId) window.clarity?.('event', event.name);
}

function trackClicks() {
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      const tracked = classifyLink(href);
      if (tracked) sendEvent(tracked, link, href);
    },
    true,
  );
  // First play of each audio element inside [data-track-audio].
  document.addEventListener(
    'play',
    (event) => {
      const el = event.target as HTMLElement | null;
      if (!el || el.tagName !== 'AUDIO' || el.dataset.trackCounted || !el.closest('[data-track-audio]')) return;
      if (!granted) return;
      el.dataset.trackCounted = '1';
      sendEvent({ name: 'audio_play' }, el);
    },
    true,
  );
}

function setupConsent() {
  const banner = document.querySelector<HTMLElement>('[data-consent]');
  if ((!ga4Id && !clarityId) || !banner) return;

  const decide = (choice: Choice) => {
    storeChoice(choice);
    banner.hidden = true;
    if (choice === 'granted') startMeasuring();
    else stopMeasuring();
  };

  banner.querySelector('[data-consent-accept]')?.addEventListener('click', () => decide('granted'));
  banner.querySelector('[data-consent-deny]')?.addEventListener('click', () => decide('denied'));
  document.querySelectorAll<HTMLElement>('[data-consent-open]').forEach((opener) => {
    opener.hidden = false;
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      banner.hidden = false;
      banner.querySelector<HTMLElement>('[data-consent-accept]')?.focus();
    });
  });
  trackClicks();

  if (hasOptedOut()) return;
  const choice = readChoice();
  if (choice === 'granted') startMeasuring();
  // Automated browsers (crawlers, agents, audits) never see the prompt and are never measured.
  // A browser-level Global Privacy Control signal counts as "Từ chối" until the visitor opts in from the footer.
  else if (choice === null && !navigator.webdriver && navigator.globalPrivacyControl !== true) banner.hidden = false;
}

setupConsent();
