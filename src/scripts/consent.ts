// Google Analytics 4 behind an explicit opt-in: nothing is requested from Google and no cookie is set
// until the visitor accepts. The choice is stored in localStorage and can be changed on /quyen-rieng-tu.
export {};

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

type Choice = 'granted' | 'denied';

const CHOICE_KEY = 'tqd_consent';
const measurementId = document.documentElement.dataset.ga4 ?? '';
const disableFlag = `ga-disable-${measurementId}`;

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

/** The existing first-party opt-out switch also turns Google Analytics off. */
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

let loaded = false;

function loadAnalytics() {
  (window as unknown as Record<string, boolean>)[disableFlag] = false;
  if (loaded) {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  loaded = true;
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', measurementId, { allow_google_signals: false, allow_ad_personalization_signals: false });

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(tag);

  // Contact intent is the conversion this site cares about.
  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    const href = link.href;
    const method = href.startsWith('mailto:')
      ? 'email'
      : href.startsWith('tel:')
        ? 'phone'
        : /^https:\/\/(www\.)?zalo\.me\//.test(href)
          ? 'zalo'
          : '';
    if (method) gtag('event', 'generate_lead', { method, link_page: location.pathname });
  });
}

function stopAnalytics() {
  (window as unknown as Record<string, boolean>)[disableFlag] = true;
  if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
  const host = location.hostname;
  const domains = ['', `; domain=${host}`, `; domain=.${host.split('.').slice(-2).join('.')}`];
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim();
    if (!name.startsWith('_ga')) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

function setupConsent() {
  const banner = document.querySelector<HTMLElement>('[data-consent]');
  if (!measurementId || !banner) return;

  const decide = (choice: Choice) => {
    storeChoice(choice);
    banner.hidden = true;
    if (choice === 'granted') loadAnalytics();
    else stopAnalytics();
  };

  banner.querySelector('[data-consent-accept]')?.addEventListener('click', () => decide('granted'));
  banner.querySelector('[data-consent-deny]')?.addEventListener('click', () => decide('denied'));
  document.querySelectorAll<HTMLElement>('[data-consent-open]').forEach((opener) => {
    opener.hidden = false;
    opener.addEventListener('click', () => {
      banner.hidden = false;
      banner.querySelector<HTMLElement>('[data-consent-accept]')?.focus();
    });
  });

  if (hasOptedOut()) return;
  const choice = readChoice();
  if (choice === 'granted') loadAnalytics();
  // Automated browsers (crawlers, agents, audits) never see the prompt and are never measured by GA4.
  else if (choice === null && !navigator.webdriver) banner.hidden = false;
}

setupConsent();
