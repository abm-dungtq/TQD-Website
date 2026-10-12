// Markdown versions of the site content, for /index.md, /{section}.md and llms.txt readers.
import {
  byGroupTotal, expertise, links, person, products, sections, stats, trainings, videos,
  type Item, type SectionId,
} from '../data/profile';

const SITE = 'https://tqd.io.vn';

const itemMarkdown = (item: Item): string => {
  const lines = [`### ${item.title}`, ''];
  if (item.date) lines.push(`_${item.date}_`, '');
  lines.push(item.summary, '', `Nhãn: ${item.tags.join(', ')}`);
  if (item.links?.length) lines.push('', item.links.map((l) => `[${l.label}](${l.href})`).join(' · '));
  return lines.join('\n');
};

const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

const bodies: Record<SectionId, () => string> = {
  'ho-so': () =>
    [`**${person.name}** (${person.handle}) — ${person.role}`, '', person.intro, '', 'Trọng tâm:', '', list(person.focus)].join('\n'),
  'san-pham': () => products.map(itemMarkdown).join('\n\n'),
  'dao-tao': () => trainings.map(itemMarkdown).join('\n\n'),
  'video-ai': () => videos.map(itemMarkdown).join('\n\n'),
  'chuyen-mon': () =>
    ['### Hướng dẫn & quy trình', '', list(expertise.howTo), '', '### Theo dõi thị trường', '', list(expertise.marketWatch)].join('\n'),
  'so-lieu': () =>
    [
      `Giai đoạn ${stats.period}.`,
      '',
      '| Chỉ số | Giá trị |',
      '|---|---|',
      ...stats.headline.map((s) => `| ${s.label} | ${s.value}${s.note ? ` (${s.note})` : ''} |`),
      '',
      '| Nhóm | Số bài |',
      '|---|---|',
      ...stats.byGroup.map((g) => `| ${g.label} | ${g.count} |`),
      `| Tổng | ${byGroupTotal} |`,
      '',
      stats.source,
    ].join('\n'),
  'lien-he': () => list(links.map((l) => `${l.label}: [${l.href.replace(/^mailto:/, '')}](${l.href})`)),
};

export function sectionMarkdown(id: SectionId): string {
  const section = sections.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown section: ${id}`);
  return `## ${section.title}\n\n${bodies[id]()}\n`;
}

export function profileMarkdown(): string {
  const parts = sections.map((s) => sectionMarkdown(s.id));
  return [`# ${person.name} (${person.handle})`, '', `> ${person.role}`, '', `Website: ${SITE}`, '', ...parts].join('\n');
}

export function llmsText(): string {
  return [
    `# ${person.name} (${person.handle})`,
    '',
    `> ${person.role}`,
    '',
    person.intro,
    '',
    '## Pages',
    '',
    ...sections.map((s) => `- [${s.title}](${SITE}/${s.id}.md): ${s.short}`),
    '',
    '## Optional',
    '',
    `- [Toàn bộ hồ sơ](${SITE}/index.md)`,
    '',
  ].join('\n');
}

export const markdownResponse = (body: string, type = 'text/markdown') =>
  new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8` } });
