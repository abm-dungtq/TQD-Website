// schema.org nodes for the pages' JSON-LD. BaseLayout adds WebSite and WebPage; pages add these.
import { introParagraphs, type Article, type Site } from './content';

const DEFAULT_ORIGIN = 'https://tqd.io.vn/';
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

/** D1 stores "YYYY-MM-DD HH:MM:SS" in UTC. */
const toIso = (value: string) => value.replace(' ', 'T') + 'Z';

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
    ...(article.publishedAt && { datePublished: toIso(article.publishedAt) }),
    dateModified: toIso(article.updatedAt),
    ...(article.coverKey && { image: new URL(`/media/${article.coverKey}`, base).href }),
    ...(article.tags.length > 0 && { keywords: article.tags.join(', ') }),
    author: { '@id': personId },
    publisher: { '@id': personId },
    mainEntityOfPage: url,
  };
};
