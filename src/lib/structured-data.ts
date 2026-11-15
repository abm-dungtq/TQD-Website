// schema.org nodes for the pages' JSON-LD. BaseLayout adds WebSite and WebPage; pages add these.
import { introParagraphs, SECTION_SEO, toIsoUtc, type Article, type Site } from './content';

export { toIsoUtc };

const DEFAULT_ORIGIN = 'https://tqd.me/';
export const PERSON_ID = `${DEFAULT_ORIGIN}#person`;

const normalizeOrigin = (origin = DEFAULT_ORIGIN) => (origin.endsWith('/') ? origin : `${origin}/`);

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
    worksFor: {
      '@type': 'Organization',
      name: 'Công ty Cổ phần Công nghệ và Đào tạo ABM',
      url: 'https://lp.abmedu.vn',
    },
    knowsAbout: person.focus,
    sameAs: links.map((l) => l.href).filter((href) => href.startsWith('https://')),
  };
};

export interface CollectionItemInput {
  name: string;
  url: string;
  description?: string;
  image?: string;
}

export interface CollectionPageOptions {
  url: string;
  origin?: string;
  name: string;
  description: string;
  items: CollectionItemInput[];
}

export const collectionPageNode = ({
  url,
  origin = DEFAULT_ORIGIN,
  name,
  description,
  items,
}: CollectionPageOptions) => {
  const base = normalizeOrigin(origin);
  return {
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name,
    description,
    inLanguage: 'vi',
    isPartOf: { '@id': `${base}#website` },
    author: { '@id': `${base}#person` },
    mainEntity: {
      '@type': 'ItemList',
      '@id': `${url}#itemlist`,
      numberOfItems: items.length,
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        url: item.url,
        ...(item.description ? { description: item.description } : {}),
        ...(item.image ? { image: item.image } : {}),
      })),
    },
  };
};

export const contactPageNode = (site: Site, canonicalUrl: string, siteOrigin = DEFAULT_ORIGIN) => {
  const base = normalizeOrigin(siteOrigin);
  const personId = `${base}#person`;
  const sameAs = (site.links ?? []).map((l) => l.href).filter((href) => href.startsWith('https://'));
  const email = site.person.email ? `mailto:${site.person.email}` : undefined;
  const zaloUrl = site.person.zalo || 'https://zalo.me/trinhquangdung';
  return {
    '@type': 'ContactPage',
    '@id': `${canonicalUrl}#contact`,
    url: canonicalUrl,
    name: `Liên hệ · ${site.person.handle}`,
    description: SECTION_SEO['lien-he'].description,
    inLanguage: 'vi',
    isPartOf: { '@id': `${base}#website` },
    about: { '@id': personId },
    mainEntity: { '@id': personId },
    ...(sameAs.length > 0 ? { sameAs } : {}),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: zaloUrl,
      ...(email ? { email } : {}),
      availableLanguage: ['vi'],
    },
  };
};

export interface XrayArticleOptions {
  url: string;
  origin?: string;
  headline: string;
  description: string;
  createdAt?: number;
  keywords?: string[];
  image?: string;
}

export const xrayArticleNode = ({
  url,
  origin = DEFAULT_ORIGIN,
  headline,
  description,
  createdAt,
  keywords = [],
  image,
}: XrayArticleOptions) => {
  const base = normalizeOrigin(origin);
  const personId = `${base}#person`;
  const dateIso = createdAt ? new Date(createdAt * 1000).toISOString() : undefined;
  return {
    '@type': 'TechArticle',
    '@id': `${url}#techarticle`,
    headline,
    description,
    url,
    inLanguage: 'vi',
    ...(dateIso ? { datePublished: dateIso, dateModified: dateIso } : {}),
    image: image || new URL('/og/xray.png', base).href,
    ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
    author: { '@id': personId },
    publisher: { '@id': personId },
    mainEntityOfPage: { '@id': `${url}#webpage` },
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
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    featureList: [
      'Tải video MP4 chuẩn H.264 và tách nhạc MP3 320kbps từ YouTube, TikTok, Douyin, Facebook Reels, Instagram',
      'Bóc băng lời thoại AI có mốc thời gian và xuất phụ đề SRT',
      'Giải phẫu X-Quang cấu trúc Hook 3 giây đầu và nhịp giữ chân người xem',
      'Chuyển thể kịch bản sang 5 định dạng và kiểm định chống văn mẫu AI Viết Pro',
    ],
    image: new URL('/og/tai-video.png', base).href,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'VND',
    },
    author: { '@id': `${base}#person` },
  };
};
