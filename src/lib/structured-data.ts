// schema.org nodes for the pages' JSON-LD. BaseLayout adds WebSite and WebPage; pages add these.
import type { Article, Site } from './content';

const ORIGIN = 'https://tqd.io.vn/';
export const PERSON_ID = `${ORIGIN}#person`;

export const personNode = ({ person, links }: Site) => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: person.name,
  alternateName: person.handle,
  jobTitle: person.role,
  description: person.intro,
  url: ORIGIN,
  image: new URL(person.portrait, ORIGIN).href,
  email: `mailto:${person.email}`,
  knowsAbout: person.focus,
  sameAs: links.map((l) => l.href).filter((href) => href.startsWith('https://')),
});

export const profilePageNode = (url: string) => ({
  '@type': 'ProfilePage',
  '@id': `${url}#profile`,
  url,
  mainEntity: { '@id': PERSON_ID },
});

/** D1 stores "YYYY-MM-DD HH:MM:SS" in UTC. */
const toIso = (value: string) => value.replace(' ', 'T') + 'Z';

export const articleNode = (article: Article, url: string) => ({
  '@type': 'Article',
  '@id': `${url}#article`,
  headline: article.title,
  description: article.summary || article.title,
  url,
  inLanguage: 'vi',
  ...(article.publishedAt && { datePublished: toIso(article.publishedAt) }),
  dateModified: toIso(article.updatedAt),
  ...(article.coverKey && { image: new URL(`/media/${article.coverKey}`, ORIGIN).href }),
  ...(article.tags.length > 0 && { keywords: article.tags.join(', ') }),
  author: { '@id': PERSON_ID },
  publisher: { '@id': PERSON_ID },
  mainEntityOfPage: url,
});
