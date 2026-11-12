// Article Markdown → safe HTML. Raw HTML in the source is never passed through.
import type { Element, ElementContent, Root, RootContent } from 'hast';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { parseTikTokId } from './tiktok';

export interface RenderMarkdownOptions {
  /** Defaults to true. Set false on untrusted public shares to unwrap external anchors into plain text. */
  allowExternalLinks?: boolean;
}

const isElement = (node: ElementContent): node is Element => node.type === 'element';

const isInternalHref = (href: string): boolean => {
  if (!href) return false;
  if ((href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#')) return true;
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).hostname.toLowerCase();
    return host === 'tqd.io.vn' || host.endsWith('.tqd.io.vn') || host === 'tqd.me' || host.endsWith('.tqd.me');
  } catch {
    return false;
  }
};

const isExternal = (href: string): boolean => {
  if (!href) return false;
  return !isInternalHref(href);
};

function extractText(node: RootContent | Root): string {
  if (node.type === 'text') return node.value;
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((c) => extractText(c)).join('');
  }
  return '';
}

function slugifyHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** Runs after sanitize: heading IDs, local images only, external links marked or unwrapped, lone TikTok links become embeds. */
const rehypeSitePolicy = (opts: Required<RenderMarkdownOptions>) => () => {
  const usedIds = new Set<string>();

  const uniqueHeadingId = (rawText: string): string => {
    const base = slugifyHeading(rawText) || 'muc';
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let idx = 2;
    while (usedIds.has(`${base}-${idx}`)) idx += 1;
    const candidate = `${base}-${idx}`;
    usedIds.add(candidate);
    return candidate;
  };

  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index === undefined) return;

      if (node.tagName === 'h2' || node.tagName === 'h3') {
        const existing = typeof node.properties?.id === 'string' ? slugifyHeading(node.properties.id) : '';
        node.properties = node.properties ?? {};
        node.properties.id = existing && !usedIds.has(existing) ? (usedIds.add(existing), existing) : uniqueHeadingId(extractText(node));
        return;
      }

      if (node.tagName === 'img') {
        const src = String(node.properties.src ?? '');
        if (!src.startsWith('/media/')) {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
        node.properties.loading = 'lazy';
        node.properties.decoding = 'async';
        return;
      }

      if (opts.allowExternalLinks && node.tagName === 'p') {
        const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
        const only = kids.length === 1 && isElement(kids[0]) && kids[0].tagName === 'a' ? kids[0] : null;
        const id = only ? parseTikTokId(String(only.properties.href ?? '')) : null;
        if (id) {
          parent.children[index] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['tiktok-embed'], dataTiktokId: id },
            children: [
              {
                type: 'element',
                tagName: 'a',
                properties: { href: `https://www.tiktok.com/player/v1/${id}`, rel: ['noopener', 'nofollow'] },
                children: [{ type: 'text', value: 'Xem video trên TikTok' }],
              },
            ],
          };
          return SKIP;
        }
      }

      if (node.tagName === 'a') {
        const href = String(node.properties.href ?? '');
        if (isExternal(href)) {
          if (!opts.allowExternalLinks) {
            parent.children.splice(index, 1, ...node.children);
            return [SKIP, index];
          }
          node.properties.rel = ['noopener', 'nofollow', 'ugc'];
        }
      }
    });
  };
};

export async function renderMarkdown(md: string, opts: RenderMarkdownOptions = {}): Promise<string> {
  const allowExternalLinks = opts.allowExternalLinks !== false;
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSitePolicy({ allowExternalLinks }))
    .use(rehypeStringify);
  return String(await processor.process(md));
}
