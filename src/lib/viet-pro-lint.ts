// Pure client/server TypeScript port of viet-pro's deterministic Vietnamese quality linter
// plus SRT subtitle & CapCut Teleprompter export helpers (zero Node/FS dependencies).

export type VietProLevel = 'ERROR' | 'WARN';
export type VietProRouteHint = 'light' | 'standard' | 'heavy';

export interface VietProFinding {
  level: VietProLevel;
  id: string;
  line: number;
  excerpt: string;
  desc?: string;
}

export interface VietProScoreResult {
  score: number;
  badgeLabel: string;
  tone: 'good' | 'warn' | 'bad';
  routeHint: VietProRouteHint;
  findings: VietProFinding[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface LineRule {
  id: string;
  level: VietProLevel;
  desc: string;
  check: (line: string) => string[];
}

export const LINE_RULES: LineRule[] = [
  {
    id: 'em-dash',
    level: 'WARN',
    desc: 'Chuẩn viet-pro ưu tiên gạch ngang ngắn " - " thay cho dấu gạch dài (—/–)',
    check: (l) => [...l.matchAll(/[—–―]/gu)].map((m) => m[0]),
  },
  {
    id: 'oxford-comma',
    level: 'WARN',
    desc: 'Tiếng Việt tự nhiên không dùng dấu phẩy Oxford ", và"',
    check: (l) => [...l.matchAll(/,\s+và\s/gu)].map((m) => m[0]),
  },
  {
    id: 'space-before-punct',
    level: 'ERROR',
    desc: 'Dấu câu phải đặt sát từ phía trước',
    check: (l) => [...l.matchAll(/\S\s+[.,!?;](?=\s|$)/gu)].map((m) => m[0]).filter((s) => !s.includes('|')),
  },
  {
    id: 'ai-label',
    level: 'WARN',
    desc: 'Nhãn mở bài sáo rỗng kiểu AI',
    check: (l) =>
      [...l.matchAll(/\b(Key insights?:|Key takeaways?:|Note:|Summary:)|Trong bài viết này/gu)].map((m) => m[0]),
  },
  {
    id: 'chatbot-residue',
    level: 'WARN',
    desc: 'Lời rào đón của chatbot còn sót lại',
    check: (l) =>
      [
        ...l.matchAll(
          /(?:^|\s)(Dưới đây là|Hy vọng (?:nội dung|bài viết|kịch bản) này hữu ích|Bạn có muốn tôi|Tôi có thể giúp bạn)/giu,
        ),
      ].map((m) => m[0].trim()),
  },
  {
    id: 'heading-colon',
    level: 'WARN',
    desc: 'Hạn chế dấu hai chấm trong tiêu đề kiểu văn dịch AI',
    check: (l) => (/^#{1,6}\s.*:\s*\S/.test(l) || /^#{1,6}\s.*:\s*$/.test(l) ? [l.trim().slice(0, 60)] : []),
  },
  {
    id: 'double-space',
    level: 'WARN',
    desc: 'Hai khoảng trắng liên tiếp giữa từ',
    check: (l) => (l.split('|').some((cell) => /\S {2,}\S/.test(cell)) ? [l.trim().slice(0, 40)] : []),
  },
  {
    id: 'title-case',
    level: 'WARN',
    desc: 'Viết Hoa Đầu Mỗi Từ kiểu tiếng Anh (tiếng Việt chỉ viết hoa chữ đầu câu và tên riêng)',
    check: (l) =>
      [...l.replace(/\[[^\]]*\]/gu, '').matchAll(/(?:\p{Lu}\p{Ll}+ ){3,}\p{Lu}\p{Ll}+/gu)].map((m) =>
        m[0].slice(0, 50),
      ),
  },
  {
    id: 'chatbot-citation',
    level: 'ERROR',
    desc: 'Dấu vết trích dẫn nội bộ của chatbot còn sót',
    check: (l) =>
      [
        ...l.matchAll(
          /:contentReference\[oaicite:\d+\](?:\{index=\d+\})?|\bturn\d+(?:search|news|view|fetch|file)\d+\b|\[cite(?::\s*[\d,\s]+)?\]|【\d+†[^】]*】|utm_source=(?:chatgpt\.com|openai|perplexity|copilot\.com|gemini)/giu,
        ),
      ].map((m) => m[0]),
  },
  {
    id: 'placeholder',
    level: 'WARN',
    desc: 'Chỗ trống mẫu chưa điền ([Tên công ty], [chèn link], XX%)',
    check: (l) =>
      [
        ...l.matchAll(
          /\[(?:Tên (?:công ty|doanh nghiệp|thương hiệu|sản phẩm|khách hàng|bạn)|chèn link|điền|placeholder)[^\]\n]*\]|\bLorem ipsum\b|\bXX(?=%|\s?(?:triệu|tỷ|nghìn|đồng|USD)(?![\p{L}\p{N}]))/giu,
        ),
      ].map((m) => m[0]),
  },
  {
    id: 'unicode-nfd',
    level: 'WARN',
    desc: 'Ký tự dấu thanh tổ hợp rời Unicode NFD (nên chuẩn hóa NFC)',
    check: (l) => [...l.matchAll(/[\p{L}\p{M}]*[\u0300-\u0303\u0306\u0309\u031B\u0323][\p{L}\p{M}]*/gu)].map((m) => m[0]),
  },
  {
    id: 'hedging-pileup',
    level: 'WARN',
    desc: 'Chồng chất nhiều lớp từ rào đón dịch thuật làm câu mơ hồ',
    check: (l) =>
      [
        ...l
          .replace(/["“][^"”\n]{1,200}["”]|`[^`\n]{1,200}`/gu, ' ')
          .matchAll(
            /\b(?:có thể sẽ\s+(?:góp phần|mang lại|tạo ra|dẫn đến|mở ra)|dường như\s+(?:có xu hướng|đang dần|có thể|được xem là)|được kỳ vọng\s+(?:sẽ\s+)?(?:mang lại khả năng|góp phần|tạo điều kiện)|có khả năng\s+(?:sẽ\s+)?(?:góp phần|tạo điều kiện|mang lại tiềm năng)|có xu hướng\s+(?:được xem là|được đánh giá là|góp phần vào việc))\b/giu,
          ),
      ].map((m) => m[0].trim()),
  },
];

const FUNCTION_WORDS = new Set(
  'và của là có được cho các những một trong với không này đó thì mà để khi đã sẽ đang cũng như từ ra vào lên theo về tại bằng hay hoặc nhưng nên vì do nếu rằng thể việc sự người cái những rất hơn nhất'.split(
    ' ',
  ),
);

const TRANSLATIONESE_PATTERNS = [
  /\b(?:việc|sự)\s+(?:triển khai|áp dụng|thực hiện|sử dụng|tối ưu|phát triển|xây dựng|đầu tư|thay đổi|kết hợp|chuyển đổi|phối hợp|kiểm tra|điều chỉnh|mở rộng|nâng cao|cải thiện|tăng cường|đảm bảo|duy trì)\b/giu,
  /\bmột cách\s+(?:nhanh chóng|chính xác|hiệu quả|toàn diện|liền mạch|rõ ràng|cụ thể|tự nhiên|chủ động|linh hoạt|triệt để|đồng bộ|bền vững|tối ưu|hợp lý|dễ dàng|hệ thống)\b/giu,
  /\bthông qua việc\b/giu,
  /\bđược\s+(?:\p{L}+\s+){1,5}bởi\b/giu,
  /\b(?:tiến hành|thực hiện việc|đưa ra sự)\s+\p{L}+/giu,
  /\bđóng vai trò\s+(?:quan trọng|then chốt|thiết yếu|quyết định|chủ chốt|trọng tâm)\b/giu,
  /(?:^|[.!?]\s+)(?:Đối với\s+[^,\n.!?;]{2,40}\s+thì|Điều này có nghĩa là)\b/giu,
  /,\s*(?:qua đó|từ đó)\s+(?:giúp|góp phần|thúc đẩy|tạo điều kiện|mang lại|nâng cao|tăng cường|mở ra)\b/giu,
  /\bcủa\s+(?:\p{L}+\s+){1,4}của\s+(?:\p{L}+\s+){1,4}của\b/giu,
];

const AI_BUZZWORD_RE =
  /\b(?:tối ưu hóa toàn diện|giải pháp toàn diện|hệ sinh thái liền mạch|trải nghiệm liền mạch|bức tranh toàn cảnh|chìa khóa then chốt|nền tảng vững chắc|khai mở tiềm năng|mở khóa tiềm năng|nâng tầm trải nghiệm|hành trình chuyển đổi(?:\s+số)?|bước ngoặt lịch sử|thay đổi cuộc chơi|định hình tương lai|giải pháp đột phá|công nghệ đột phá|tiêu chuẩn vàng|kim chỉ nam)\b/giu;

const frontmatterEnd = (lines: string[]) =>
  lines[0]?.trim() === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') : -1;

function stripProtectedBlocks(text: string): string {
  const lines = text.split('\n');
  let inFence = false;
  let inFrontmatter = frontmatterEnd(lines) > 0;
  return lines
    .map((line, i) => {
      if (i === 0 && inFrontmatter) return '';
      if (inFrontmatter) {
        if (line.trim() === '---') inFrontmatter = false;
        return '';
      }
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

function stripQuotedAndKept(text: string, keep: string[] = []): string {
  let out = text.replace(/["“][^"”\n]{1,200}["”]|`[^`\n]{1,200}`/gu, ' ');
  for (const k of keep) {
    if (!k) continue;
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    out = out.replace(new RegExp(escaped, 'giu'), ' ');
  }
  return out;
}

function paragraphClusters(text: string, keep: string[] = []): VietProFinding[] {
  const findings: VietProFinding[] = [];
  const lines = text.split('\n');
  const paragraphs: Array<{ startLine: number; text: string }> = [];
  let current: { startLine: number; text: string } | null = null;

  lines.forEach((raw, idx) => {
    const t = raw.trim();
    const isProse = t && !t.startsWith('#') && !t.startsWith('|') && !t.startsWith('>') && !/^\[[^\]]+\]$/u.test(t);
    if (!isProse) {
      if (current) {
        paragraphs.push(current);
        current = null;
      }
      return;
    }
    if (!current) current = { startLine: idx + 1, text: t };
    else current.text += ` ${t}`;
  });
  if (current) paragraphs.push(current);

  for (const p of paragraphs) {
    const cleaned = stripQuotedAndKept(p.text, keep);
    const transHits: string[] = [];
    for (const re of TRANSLATIONESE_PATTERNS) {
      for (const m of cleaned.matchAll(re)) transHits.push(m[0].replace(/^[.,!?\s]+/u, '').trim());
    }
    if (transHits.length >= 3) {
      findings.push({
        level: 'WARN',
        id: 'translationese-cluster',
        line: p.startLine,
        excerpt: `Cụm văn dịch (${transHits.length} dấu hiệu): ${transHits
          .slice(0, 4)
          .map((x) => `"${x}"`)
          .join(', ')}`,
        desc: 'Nhiều cấu trúc dịch sát tiếng Anh tụ trong cùng đoạn',
      });
    }
    const buzzHits = [...cleaned.matchAll(AI_BUZZWORD_RE)].map((m) => m[0].trim());
    if (buzzHits.length >= 3) {
      findings.push({
        level: 'WARN',
        id: 'ai-buzzword-cluster',
        line: p.startLine,
        excerpt: `Cụm sáo ngữ AI (${buzzHits.length} cụm): ${buzzHits
          .slice(0, 4)
          .map((x) => `"${x}"`)
          .join(', ')}`,
        desc: 'Tụ nhiều cụm từ marketing sáo rỗng kiểu AI',
      });
    }
    const sents = cleaned
      .split(/(?<=[.!?])\s+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);
    const openSig = (s: string) => {
      const clause = s.match(/^([\p{L}]+)\s+(?:[\p{L}\p{N}]+\s+){1,10}[\p{L}\p{N}]+,/u);
      if (clause) return `${clause[1].toLowerCase()}...,`;
      const pair = s.match(/^([\p{L}]+\s+[\p{L}]+)\b/u);
      return pair ? pair[1].toLowerCase() : null;
    };
    for (let i = 0; i + 2 < sents.length; i++) {
      const s0 = openSig(sents[i]);
      if (s0 && s0 === openSig(sents[i + 1]) && s0 === openSig(sents[i + 2])) {
        findings.push({
          level: 'WARN',
          id: 'isomorphic-sentence',
          line: p.startLine,
          excerpt: `3 câu liên tiếp mở đầu cùng khuôn "${s0}"`,
          desc: 'Ba câu liên tiếp lặp cùng cấu trúc mở đầu',
        });
        break;
      }
    }
  }
  return findings;
}

function phraseReuse(text: string, keep: string[] = []): VietProFinding[] {
  const keepLower = keep.map((k) => k.toLowerCase());
  const segments = text
    .toLowerCase()
    .split(/[.!?;:\n]+/u)
    .map((s) => s.match(/[\p{L}\p{N}]+/gu) || []);

  const found: Array<{ at: Array<[number, number]>; len: number; c: number }> = [];
  const words = (f: { at: Array<[number, number]>; len: number }) =>
    segments[f.at[0][0]].slice(f.at[0][1], f.at[0][1] + f.len).join(' ');
  const shifted = (at: Array<[number, number]>, by: number) => at.map(([s, i]) => `${s}:${i + by}`).join(',');

  for (let n = 8; n >= 5; n--) {
    const occ = new Map<string, Array<[number, number]>>();
    segments.forEach((toks, s) => {
      for (let i = 0; i + n <= toks.length; i++) {
        const g = toks.slice(i, i + n);
        if (g.every((t) => FUNCTION_WORDS.has(t))) continue;
        const key = g.join(' ');
        const list = occ.get(key);
        if (list) list.push([s, i]);
        else occ.set(key, [[s, i]]);
      }
    });
    for (const [phrase, at] of occ) {
      const c = at.length;
      if (c < 3) continue;
      if (found.some((f) => ` ${words(f)} `.includes(` ${phrase} `))) continue;
      if (keepLower.some((k) => ` ${k} `.includes(` ${phrase} `) || ` ${phrase} `.includes(` ${k} `))) continue;
      const here = shifted(at, 0);
      const after = found.find((f) => f.c === c && shifted(f.at, f.len - n + 1) === here);
      if (after) {
        after.len++;
        continue;
      }
      const before = found.find((f) => f.c === c && shifted(f.at, -1) === here);
      if (before) {
        before.at = at;
        before.len++;
        continue;
      }
      found.push({ at, len: n, c });
    }
  }

  return found.map((f) => {
    const phrase = words(f);
    const shown = phrase.length > 120 ? `${phrase.slice(0, 117)}...` : phrase;
    return {
      level: 'WARN',
      id: 'phrase-reuse',
      line: 0,
      excerpt: `"${shown}" lặp ${f.c} lần`,
      desc: 'Lặp nguyên cụm từ nhiều lần làm giảm độ tự nhiên',
    };
  });
}

function textRules(text: string, opts: { keep?: string[] } = {}): VietProFinding[] {
  const findings: VietProFinding[] = [];
  for (const w of ['Tuy nhiên,', 'Bên cạnh đó,', 'Ngoài ra,']) {
    const n = text.split(w).length - 1;
    if (n > 3) {
      findings.push({
        level: 'WARN',
        id: 'transition-overuse',
        line: 0,
        excerpt: `"${w}" xuất hiện ${n} lần (>3)`,
        desc: 'Lạm dụng từ nối học thuật kiểu văn mẫu AI',
      });
    }
  }
  const proseLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('|'));
  const opener = proseLines
    .slice(0, 3)
    .find((l) => /^(Hãy tưởng tượng|Trong (?:bối cảnh|thế giới|kỷ nguyên)\b|Xin chào các bạn)/iu.test(l));
  if (opener) {
    findings.push({
      level: 'WARN',
      id: 'staged-opener',
      line: 0,
      excerpt: opener.slice(0, 90),
      desc: 'Mở đầu dàn dựng kiểu văn mẫu thay vì vào thẳng vấn đề',
    });
  }

  const contrasts = [...text.matchAll(/không\s+(?:chỉ|phải)\s+[^.!?\n]{0,120}(?:mà\s+còn|mà\s+là)/giu)];
  if (contrasts.length > 1) {
    findings.push({
      level: 'WARN',
      id: 'contrast-formula-repeat',
      line: 0,
      excerpt: `Công thức đối lập "không chỉ... mà còn" xuất hiện ${contrasts.length} lần`,
      desc: 'Lặp công thức đối lập quen thuộc của AI',
    });
  }

  const boldLabels = [...text.matchAll(/^\s*\*\*[^*\n:]{1,40}:\*\*/gmu)];
  if (boldLabels.length >= 3) {
    findings.push({
      level: 'WARN',
      id: 'decorative-bold-labels',
      line: 0,
      excerpt: `${boldLabels.length} đoạn mở bằng nhãn in đậm "**Nhãn:**"`,
      desc: 'Lạm dụng nhãn in đậm đầu đoạn kiểu báo cáo AI',
    });
  }

  const dramaticClosers = proseLines.filter(
    (l) =>
      l.length <= 100 &&
      /^(Và đó mới là|Đó mới là điều|Không ai (?:còn )?có thể làm ngơ|Hãy để điều đó)/iu.test(l),
  );
  if (dramaticClosers.length > 1) {
    findings.push({
      level: 'WARN',
      id: 'dramatic-closer-repeat',
      line: 0,
      excerpt: `${dramaticClosers.length} câu kết kịch tính kiểu dịch thuật`,
      desc: 'Câu kết cường điệu kiểu dịch từ tiếng Anh',
    });
  }

  const toneTarget = stripQuotedAndKept(text, opts.keep);
  const oldTones = [...toneTarget.matchAll(/\p{L}*(?<![qgQG])(?:o[àáảãạ]|o[èéẻẽẹ]|u[ỳýỷỹỵ])(?![\p{L}\p{M}])/giu)].map(
    (m) => m[0],
  );
  const newTones = [...toneTarget.matchAll(/\p{L}*(?<![qgQG])(?:[òóỏõọ][ae]|[ùúủũụ]y)(?![\p{L}\p{M}])/giu)].map(
    (m) => m[0],
  );
  if (oldTones.length > 0 && newTones.length > 0) {
    findings.push({
      level: 'WARN',
      id: 'inconsistent-tone-mark',
      line: 0,
      excerpt: `Trộn kiểu bỏ dấu cũ ("${oldTones[0]}") và mới ("${newTones[0]}")`,
      desc: 'Trộn hai quy tắc đặt dấu thanh oa/oe/uy trong cùng văn bản',
    });
  }

  findings.push(...phraseReuse(text, opts.keep));
  findings.push(...paragraphClusters(text, opts.keep));
  return findings;
}

export function lintVietProText(text: string, opts: { keep?: string[] } = {}): VietProFinding[] {
  if (!text || !text.trim()) return [];
  const findings: VietProFinding[] = [];
  const lines = text.split('\n');
  let inFence = false;
  let inFrontmatter = frontmatterEnd(lines) > 0;

  lines.forEach((line, i) => {
    if (i === 0 && inFrontmatter) return;
    if (inFrontmatter) {
      if (line.trim() === '---') inFrontmatter = false;
      return;
    }
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    for (const rule of LINE_RULES) {
      for (const excerpt of rule.check(line)) {
        findings.push({ level: rule.level, id: rule.id, line: i + 1, excerpt, desc: rule.desc });
      }
    }
  });

  findings.push(...textRules(stripProtectedBlocks(text), opts));
  return findings;
}

export function computeVietProScore(text: string, opts: { keep?: string[] } = {}): VietProScoreResult {
  const findings = lintVietProText(text, opts);
  const hasHeavy = findings.some(
    (f) =>
      f.level === 'ERROR' ||
      ['translationese-cluster', 'ai-buzzword-cluster', 'isomorphic-sentence'].includes(f.id),
  );
  const routeHint: VietProRouteHint = !findings.length
    ? 'light'
    : hasHeavy || findings.length >= 5
      ? 'heavy'
      : 'standard';

  let penalty = 0;
  const ruleCounts = new Map<string, number>();
  for (const f of findings) {
    const seen = (ruleCounts.get(f.id) ?? 0) + 1;
    ruleCounts.set(f.id, seen);
    // Cap repeated occurrences of same minor rule (e.g. multiple em-dashes) so score stays proportional
    if (seen > 3) continue;
    if (f.level === 'ERROR') penalty += 14;
    else if (['translationese-cluster', 'ai-buzzword-cluster', 'isomorphic-sentence', 'staged-opener'].includes(f.id)) {
      penalty += 10;
    } else {
      penalty += 4;
    }
  }

  const score = Math.max(35, Math.min(100, 100 - penalty));
  if (score >= 94) {
    return {
      score,
      badgeLabel: `Chuẩn Viết Pro: ${score}/100 · Tự nhiên như người thật`,
      tone: 'good',
      routeHint,
      findings,
    };
  }
  if (score >= 80) {
    return {
      score,
      badgeLabel: `Điểm Viết Pro: ${score}/100 · Khá mượt (${findings.length} gợi ý gọt)`,
      tone: 'warn',
      routeHint,
      findings,
    };
  }
  return {
    score,
    badgeLabel: `Điểm Viết Pro: ${score}/100 · Có vệt văn mẫu AI (${findings.length} điểm)`,
    tone: 'bad',
    routeHint,
    findings,
  };
}

function formatSrtTime(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const mins = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(
    ms,
  ).padStart(3, '0')}`;
}

/** Converts timestamped transcript segments into standard SubRip (.srt) format for CapCut / Premiere. */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  return segments
    .filter((s) => s.text && s.text.trim())
    .map((seg, idx) => {
      const start = seg.start;
      const end = Math.max(start + 0.8, seg.end || start + 2.5);
      return `${idx + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${seg.text.trim()}`;
    })
    .join('\n\n');
}

/**
 * Extracts clean spoken lines from a 3-column Markdown video script table (column 2: Voice-over)
 * or strips markdown formatting so creators can paste directly into CapCut Teleprompter.
 */
export function extractCapCutTeleprompterText(markdown: string): string {
  if (!markdown) return '';
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const voiceLines: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    // Skip markdown separator row (|---|---|---|) and table header row
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    if (/^(thời điểm|mốc|time|giây|cảnh)/iu.test(cells[0]) && /^(lời|voice|thoại)/iu.test(cells[1])) continue;

    const spoken = cells[1]
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^["“]|["”]$/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .trim();
    if (spoken) voiceLines.push(spoken);
  }

  if (voiceLines.length >= 2) {
    return voiceLines.join('\n\n');
  }

  // Fallback for prose formats (FB story, Threads, YouTube outline): clean markdown marks
  return lines
    .filter((l) => !/^#{1,6}\s/.test(l.trim()) && l.trim() !== '---')
    .map((l) => l.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
    .join('\n\n');
}
