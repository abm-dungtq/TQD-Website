// Minimal HTML → Markdown conversion for post bodies returned by the EzyPlatform public API.
// The old reader endpoints served author-written Markdown; after the migration the source of truth is HTML, so the
// twins convert it back. It intentionally covers only the tags the article editor emits (headings, paragraphs,
// emphasis, links, images, lists, quotes, code and simple tables) and strips everything else.

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  times: '×',
  middot: '·',
  bull: '•',
  deg: '°',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const stripTags = (html: string): string => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Plain text of an HTML fragment, used for fallbacks such as a product summary. */
export const htmlToText = (html: string): string => stripTags(html);

function convertTables(html: string): string {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_whole, inner: string) => {
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(inner)) !== null) {
      const cells: string[] = [];
      const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
        cells.push(stripTags(cellMatch[1]).replace(/\|/g, '\\|'));
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const pad = (cells: string[]) => [...cells, ...Array(width - cells.length).fill('')];
    const line = (cells: string[]) => `| ${pad(cells).join(' | ')} |`;
    const out = [line(rows[0]), `| ${Array(width).fill('---').join(' | ')} |`];
    for (const row of rows.slice(1)) out.push(line(row));
    return `\n\n${out.join('\n')}\n\n`;
  });
}

export function htmlToMarkdown(rawHtml: string): string {
  if (!rawHtml) return '';
  let html = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '');

  html = convertTables(html);

  html = html
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => `\n\n${'#'.repeat(Number(level))} ${stripTags(inner)}\n\n`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => {
      const text = htmlToMarkdown(inner)
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return `\n\n${text}\n\n`;
    })
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
      const code = decodeEntities(inner.replace(/<[^>]*>/g, '')).replace(/\n$/, '');
      return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
    })
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner: string) => {
      const text = decodeEntities(inner.replace(/<[^>]*>/g, ''));
      return text.includes('`') ? text : `\`${text}\``;
    })
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag: string, inner: string) => {
      const text = inner.replace(/<[^>]*>/g, '').trim();
      return text ? `**${decodeEntities(text)}**` : '';
    })
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag: string, inner: string) => {
      const text = inner.replace(/<[^>]*>/g, '').trim();
      return text ? `*${decodeEntities(text)}*` : '';
    })
    .replace(/<a\b[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
      const label = stripTags(inner) || href;
      const url = decodeEntities(href).trim();
      if (!url || url.startsWith('javascript:')) return label;
      return `[${label}](${url})`;
    })
    .replace(/<img\b[^>]*>/gi, (tag: string) => {
      const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(tag)?.[1];
      if (!src) return '';
      const alt = /\balt\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? '';
      return `![${decodeEntities(alt)}](${decodeEntities(src)})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\b[^>]*\/?>/gi, '\n\n---\n\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(ul|ol|li)>/gi, '\n')
    .replace(/<(p|div|section|article|header|footer|main|aside|figure|figcaption)\b[^>]*>/gi, '\n\n')
    .replace(/<\/(p|div|section|article|header|footer|main|aside|figure|figcaption)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  html = decodeEntities(html)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*\s*\*\*/g, '')
    .trim();

  return html;
}
