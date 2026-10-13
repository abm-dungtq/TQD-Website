// Markdown versions of the site content, for /index.md, /{section}.md and llms.txt readers.
import type { Item, SectionId, SiteData } from './content';

const SITE = 'https://tqd.io.vn';

const itemMarkdown = (item: Item): string => {
  const lines = [`### ${item.title}`, ''];
  if (item.date) lines.push(`_${item.date}_`, '');
  lines.push(item.summary, '', `Nhãn: ${item.tags.join(', ')}`);
  if (item.tiktokId) lines.push('', `Video: https://www.tiktok.com/player/v1/${item.tiktokId}`);
  if (item.links?.length) lines.push('', item.links.map((l) => `[${l.label}](${l.href})`).join(' · '));
  return lines.join('\n');
};

const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

function sectionBody(id: SectionId, data: SiteData): string {
  const { person, links, topics } = data.site;
  switch (id) {
    case 'ho-so':
      return [`**${person.name}** (${person.handle}) — ${person.role}`, '', person.intro, '', 'Trọng tâm:', '', list(person.focus)].join('\n');
    case 'san-pham':
      return data.products.map(itemMarkdown).join('\n\n');
    case 'dao-tao':
      return data.trainings.map(itemMarkdown).join('\n\n');
    case 'video-ai':
      return data.videos.map(itemMarkdown).join('\n\n');
    case 'bai-viet':
      return data.articles.length
        ? list(data.articles.map((a) => `[${a.title}](${SITE}/bai-viet/${a.slug})${a.summary ? `: ${a.summary}` : ''}`))
        : ['Chưa có bài viết.', '', '### Chủ đề thường viết', '', list([...topics.howTo, ...topics.marketWatch])].join('\n');
    case 'lien-he':
      return list(links.map((l) => `${l.label}: [${l.href.replace(/^mailto:/, '')}](${l.href})`));
  }
}

export function sectionMarkdown(id: SectionId, data: SiteData): string | null {
  const section = data.site.sections.find((s) => s.id === id);
  if (!section) return null;
  return `## ${section.title}\n\n${sectionBody(id, data)}\n`;
}

export function profileMarkdown(data: SiteData): string {
  const { person, sections } = data.site;
  const parts = sections.map((s) => sectionMarkdown(s.id, data) ?? '');
  return [`# ${person.name} (${person.handle})`, '', `> ${person.role}`, '', `Website: ${SITE}`, '', ...parts].join('\n');
}

export function llmsText(data: SiteData): string {
  const { person, sections } = data.site;
  const lines = [
    `# ${person.name} (${person.handle})`,
    '',
    `> ${person.role}`,
    '',
    person.intro,
    '',
    '## Pages',
    '',
    ...sections.map((s) => `- [${s.title}](${SITE}/${s.id}.md): ${s.short}`),
  ];
  if (data.articles.length) {
    lines.push('', '## Bài viết', '', ...data.articles.map((a) => `- [${a.title}](${SITE}/bai-viet/${a.slug}.md)`));
  }
  lines.push('', '## Optional', '', `- [Toàn bộ hồ sơ](${SITE}/index.md)`, '');
  return lines.join('\n');
}

export const markdownResponse = (body: string, type = 'text/markdown') =>
  // Markdown twins and llms.txt are for agents; noindex keeps them from competing with the HTML pages in search.
  new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8`, 'X-Robots-Tag': 'noindex' } });
