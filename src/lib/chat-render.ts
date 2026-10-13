// Turns an agent reply into a small, safe structure: paragraphs, lists, bold and links.
// Only links to this site become anchors, so a manipulated answer cannot put a scam link under DũngTQ's name.
// The browser builds DOM nodes from the result with textContent; nothing here is ever parsed as HTML.

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'link'; text: string; href: string };
export type Block = { kind: 'p'; lines: Inline[][] } | { kind: 'ul' | 'ol'; items: Inline[][] };

const SITE = /^https:\/\/tqd\.io\.vn(?:[/?#]\S*)?$/;
const TRAILING = /[.,;:!?)\]]+$/;
const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
// Markdown link, bold, or bare URL.
const TOKEN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>"']+)/g;

/** True for https links on tqd.io.vn only. */
export const isSiteUrl = (url: string): boolean => SITE.test(url);

function pushText(out: Inline[], text: string) {
  if (!text) return;
  const last = out.at(-1);
  if (last?.kind === 'text') last.text += text;
  else out.push({ kind: 'text', text });
}

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of line.matchAll(TOKEN)) {
    pushText(out, line.slice(at, m.index));
    at = m.index + m[0].length;
    const [, label, labelUrl, bold, bare] = m;
    if (bold) out.push({ kind: 'bold', text: bold });
    else if (labelUrl) {
      if (isSiteUrl(labelUrl)) out.push({ kind: 'link', text: label, href: labelUrl });
      else pushText(out, `${label} (${labelUrl})`);
    } else if (bare) {
      // Sentence punctuation after a URL belongs to the sentence, not the link.
      const tail = bare.match(TRAILING)?.[0] ?? '';
      const url = tail ? bare.slice(0, -tail.length) : bare;
      if (isSiteUrl(url)) out.push({ kind: 'link', text: url, href: url });
      else pushText(out, url);
      pushText(out, tail);
    }
  }
  pushText(out, line.slice(at));
  return out;
}

/** Strips markdown heading marks, so "## Tiêu đề" reads as a bold line. */
function lineInline(line: string): Inline[] {
  const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
  return heading ? [{ kind: 'bold', text: heading[1].replace(/\*\*/g, '') }] : parseInline(line);
}

export function parseReply(text: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] | null = null;
  let list: { kind: 'ul' | 'ol'; items: Inline[][] } | null = null;
  const flush = () => {
    if (para) blocks.push({ kind: 'p', lines: para });
    if (list) blocks.push(list);
    para = null;
    list = null;
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const kind = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null;
    if (kind) {
      if (!list || list.kind !== kind) {
        flush();
        list = { kind, items: [] };
      }
      list.items.push(lineInline(line.replace(kind === 'ul' ? BULLET : NUMBER, '')));
      continue;
    }
    if (list) flush();
    (para ??= []).push(lineInline(line));
  }
  flush();
  return blocks;
}
