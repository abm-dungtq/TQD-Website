// Vietnamese-aware heading anchor injector, Table of Contents extractor, and reading-time estimator.
// Operates on sanitized article bodyHtml at render time so existing D1-cached HTML gets #anchor IDs immediately.

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITY_MAP[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16) || 32));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyVietnamese(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
  return base || 'muc';
}

export function injectHeadingIdsAndToc(bodyHtml: string): {
  html: string;
  headings: TocHeading[];
} {
  if (!bodyHtml) return { html: '', headings: [] };

  const usedIds = new Set<string>();
  const headings: TocHeading[] = [];

  const nextUniqueId = (candidate: string): string => {
    let slug = candidate || 'muc';
    if (!usedIds.has(slug)) {
      usedIds.add(slug);
      return slug;
    }
    let counter = 2;
    while (usedIds.has(`${slug}-${counter}`)) counter += 1;
    const unique = `${slug}-${counter}`;
    usedIds.add(unique);
    return unique;
  };

  const html = bodyHtml.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (full, lvlStr, rawAttrs = '', inner = '') => {
    const level = (lvlStr === '2' ? 2 : 3) as 2 | 3;
    const text = stripTags(inner);
    if (!text) return full;

    const existingMatch = rawAttrs.match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    const rawExistingId = existingMatch?.[1] ?? existingMatch?.[2] ?? '';

    let id: string;
    let attrs = rawAttrs;
    if (rawExistingId) {
      id = nextUniqueId(slugifyVietnamese(rawExistingId));
      if (id !== rawExistingId) {
        attrs = rawAttrs.replace(/\bid\s*=\s*(?:"[^"]+"|'[^']+')/i, `id="${id}"`);
      }
    } else {
      id = nextUniqueId(slugifyVietnamese(text));
      attrs = `${rawAttrs} id="${id}"`;
    }

    headings.push({ id, text, level });
    return `<h${level}${attrs}>${inner}</h${level}>`;
  });

  return { html, headings };
}

/** Vietnamese prose reading speed averages ~210 words/min. */
export function estimateReadingMinutes(markdownOrHtml: string): number {
  const plain = stripTags(markdownOrHtml);
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 210));
}
