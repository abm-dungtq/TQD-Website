/**
 * Article pages (/bai-viet/<slug>): reading time and table of contents, ported from the old src/lib/toc.ts.
 *
 * Reading time: migrated posts render the old build-time value (Markdown source, ~210 words/min) server-side while
 * their content is unchanged; posts written or edited in the EzyPlatform admin get a hidden `[data-reading-time]`
 * placeholder that is filled here from the rendered body.
 *
 * TOC: rebuilt from this post's h2/h3; heading text has tags replaced by spaces, ids are Vietnamese slugs (72
 * chars, unique with -2, -3…), and the block shows only with 3+ h2, as on the old site.
 */
const TOC_LINK_CLASS =
  'inline-flex min-h-11 sm:min-h-9 items-center py-1 text-ink/90 no-underline hover:text-accent hover:underline';

// A textarea parses its content as text only, so decoding entities can never create elements.
const decoder = document.createElement('textarea');

/** Old `stripTags`: every tag becomes a space, then entities are decoded. */
function plainText(html: string): string {
  decoder.innerHTML = html.replace(/<[^>]*>/g, ' ');
  return decoder.value.replace(/\s+/g, ' ').trim();
}

function slugifyVietnamese(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
  return base || 'muc';
}

function readingTime(body: HTMLElement): void {
  const words = plainText(body.innerHTML).split(' ').filter(Boolean).length;
  for (const node of document.querySelectorAll<HTMLElement>('[data-reading-time]')) {
    node.textContent = `· ~${Math.max(1, Math.round(words / 210))} phút đọc`;
    node.hidden = false;
  }
}

function tableOfContents(body: HTMLElement): void {
  const toc = document.querySelector<HTMLElement>('[data-toc]');
  const list = toc?.querySelector('ol');
  const count = toc?.querySelector('[data-toc-count]');
  if (!toc || !list || !count) return;

  const used = new Set<string>();
  const items: { level3: boolean; id: string; text: string }[] = [];
  for (const heading of body.querySelectorAll<HTMLElement>('h2, h3')) {
    const text = plainText(heading.innerHTML);
    if (!text) continue;
    let id = slugifyVietnamese(heading.id || text);
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    used.add(id);
    heading.id = id;
    items.push({ level3: heading.tagName === 'H3', id, text });
  }
  if (items.filter((item) => !item.level3).length < 3) return;

  for (const item of items) {
    const li = document.createElement('li');
    li.className = item.level3 ? 'pl-4' : '';
    const link = document.createElement('a');
    link.href = `#${item.id}`;
    link.className = TOC_LINK_CLASS;
    link.textContent = item.text;
    li.append(link);
    list.append(li);
  }
  count.textContent = `Mục lục bài viết (${items.length} phần)`;
  toc.hidden = false;
  // ids exist only now, so a deep link to a heading needs a second scroll
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

const body = document.querySelector<HTMLElement>('.prose-article');
if (body) {
  readingTime(body);
  tableOfContents(body);
}
