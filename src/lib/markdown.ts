// Article Markdown → safe HTML. Raw HTML in the source is never passed through.
import type { Element, ElementContent, Root } from 'hast';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { parseTikTokId } from './tiktok';

const isElement = (node: ElementContent): node is Element => node.type === 'element';

const isExternal = (href: string): boolean => {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).hostname;
    return host !== 'tqd.io.vn' && !host.endsWith('.tqd.io.vn');
  } catch {
    return true;
  }
};

/** Runs after sanitize: local images only, external links marked, lone TikTok links become embeds. */
const rehypeSitePolicy = () => (tree: Root) => {
  visit(tree, 'element', (node, index, parent) => {
    if (!parent || index === undefined) return;

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

    if (node.tagName === 'a' && isExternal(String(node.properties.href ?? ''))) {
      node.properties.rel = ['noopener', 'nofollow', 'ugc'];
      return;
    }

    if (node.tagName === 'p') {
      const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      const only = kids.length === 1 && isElement(kids[0]) && kids[0].tagName === 'a' ? kids[0] : null;
      const id = only ? parseTikTokId(String(only.properties.href ?? '')) : null;
      if (!id) return;
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
  });
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeSitePolicy)
  .use(rehypeStringify);

export async function renderMarkdown(md: string): Promise<string> {
  return String(await processor.process(md));
}
