// schema.org nodes for the pages' JSON-LD. BaseLayout adds WebSite and WebPage; pages add these.
import { introParagraphs, type Article, type Site } from './content';

const DEFAULT_ORIGIN = 'https://tqd.me/';
export const PERSON_ID = `${DEFAULT_ORIGIN}#person`;

const normalizeOrigin = (origin = DEFAULT_ORIGIN) => (origin.endsWith('/') ? origin : `${origin}/`);

export const toIsoUtc = (value: string) => (value.includes('T') ? value : value.replace(' ', 'T') + 'Z');

export const personNode = ({ person, links }: Site, origin = DEFAULT_ORIGIN) => {
  const base = normalizeOrigin(origin);
  return {
    '@type': 'Person',
    '@id': `${base}#person`,
    name: person.name,
    alternateName: person.handle,
    jobTitle: person.role,
    description: introParagraphs(person.intro).join(' '),
    url: base,
    image: new URL(person.portrait, base).href,
    email: `mailto:${person.email}`,
    knowsAbout: person.focus,
    sameAs: links.map((l) => l.href).filter((href) => href.startsWith('https://')),
  };
};

export const profilePageNode = (url: string) => {
  const base = normalizeOrigin(new URL('/', url).href);
  return {
    '@type': 'ProfilePage',
    '@id': `${url}#profile`,
    url,
    mainEntity: { '@id': `${base}#person` },
  };
};

export const articleNode = (article: Article, url: string) => {
  const base = normalizeOrigin(new URL('/', url).href);
  const personId = `${base}#person`;
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.summary || article.title,
    url,
    inLanguage: 'vi',
    ...(article.publishedAt && { datePublished: toIsoUtc(article.publishedAt) }),
    dateModified: toIsoUtc(article.updatedAt),
    image: article.coverKey
      ? new URL(`/media/${article.coverKey}`, base).href
      : new URL('/og/bai-viet.png', base).href,
    ...(article.tags.length > 0 && { keywords: article.tags.join(', ') }),
    author: { '@id': personId },
    publisher: { '@id': personId },
    mainEntityOfPage: { '@id': `${url}#webpage` },
  };
};

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export const breadcrumbNode = (items: BreadcrumbItem[], pageUrl: string) => ({
  '@type': 'BreadcrumbList',
  '@id': `${pageUrl}#breadcrumb`,
  itemListElement: items.map((item, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: item.name,
    item: item.url,
  })),
});

export const webAppNode = (url: string, origin = DEFAULT_ORIGIN) => {
  const base = normalizeOrigin(origin);
  return {
    '@type': 'WebApplication',
    '@id': `${url}#webapp`,
    name: 'Tải Video Đa Nền Tảng & Xưởng Mổ Xẻ Kịch Bản Viral AI',
    description:
      'Công cụ tải video MP4 chuẩn H.264, tách nhạc MP3 320kbps, bóc băng lời thoại AI và nhân bản kịch bản Viral theo chuẩn chống văn mẫu AI Viết Pro.',
    url,
    inLanguage: 'vi',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All',
    image: new URL('/og/tai-video.png', base).href,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'VND',
    },
    author: { '@id': `${base}#person` },
  };
};
