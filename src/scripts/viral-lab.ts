// Client-side controller for TQD Viral Video Lab (/tai-video Tab 2):
// Hybrid Transcript viewer, SRT & CapCut export, SSE streaming for Viral X-Ray & Viet-Pro Multi-Format Studio,
// client-side deterministic Viet-Pro anti-AI-slop linter, and /xray/[id] shareable permalink generator.

import { isPlaylistOrProfileUrl, validateSafeMediaUrl } from '../lib/dl-platforms';
import {
  computeVietProScore,
  extractCapCutTeleprompterText,
  segmentsToSrt,
  type TranscriptSegment,
  type VietProFinding,
} from '../lib/viet-pro-lint';

interface ClientTranscript {
  videoHash: string;
  platform: string;
  platformLabel: string;
  canonicalUrl: string;
  title: string;
  uploader: string;
  duration: number;
  thumbnail: string;
  language: string;
  sourceKind: 'subtitles' | 'whisper';
  transcriptText: string;
  segments: TranscriptSegment[];
  cached?: boolean;
}

export interface ViralLabDeps {
  getUrlInput: () => string;
  setUrlInput: (url: string) => void;
  getVisitorId: () => string;
  showAlert: (msg: string, isError?: boolean) => void;
  switchToViralTab: () => void;
}

function formatTimestamp(sec: number): string {
  const total = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cleanLabel(raw?: string): string {
  return (raw || '').replace(/^[^\p{L}\p{N}]+\s*/u, '').trim();
}

/** Appends inline Markdown (`**bold**` and `` `code` ``) safely via `textContent` (never innerHTML). */
function appendInlineMarkdown(parent: HTMLElement, text: string): void {
  const tokenRe = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIdx = 0;
  for (const m of text.matchAll(tokenRe)) {
    const idx = m.index ?? 0;
    if (idx > lastIdx) {
      parent.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
    }
    if (m[1] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = m[1];
      parent.appendChild(strong);
    } else if (m[2] !== undefined) {
      const code = document.createElement('code');
      code.className = 'rounded bg-tint px-1 py-0.5 font-mono text-xs';
      code.textContent = m[2];
      parent.appendChild(code);
    }
    lastIdx = idx + m[0].length;
  }
  if (lastIdx < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}

/** Safe DOM-only renderer for GFM Markdown (Headings, Lists, `---` Threads cards, and 3-column Tables). */
export function renderSafeMarkdown(container: HTMLElement, markdown: string): void {
  container.replaceChildren();
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule / Threads post separator
    if (/^-{3,}$/.test(trimmed)) {
      const hr = document.createElement('hr');
      container.appendChild(hr);
      i++;
      continue;
    }

    // Heading (# .. ####)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const h = document.createElement(level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5');
      h.className =
        level <= 2
          ? 'display mt-3 mb-1.5 text-lg font-semibold text-ink sm:text-xl'
          : 'mt-2.5 mb-1 text-sm font-bold text-accent-ink';
      appendInlineMarkdown(h, headingMatch[2]);
      container.appendChild(h);
      i++;
      continue;
    }

    // GFM Markdown Table (| Col 1 | Col 2 | Col 3 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());

        const headerCells = parseRow(tableLines[0]);
        const hasSep = tableLines[1] && parseRow(tableLines[1]).every((c) => /^:?-{2,}:?$/.test(c));
        const bodyRows = tableLines.slice(hasSep ? 2 : 1).map(parseRow);

        const wrap = document.createElement('div');
        wrap.className = 'my-2 overflow-x-auto';
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        for (const hc of headerCells) {
          const th = document.createElement('th');
          appendInlineMarkdown(th, hc);
          trHead.appendChild(th);
        }
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const row of bodyRows) {
          if (row.every((c) => /^:?-{2,}:?$/.test(c))) continue;
          const tr = document.createElement('tr');
          for (let colIdx = 0; colIdx < headerCells.length; colIdx++) {
            const td = document.createElement('td');
            appendInlineMarkdown(td, row[colIdx] ?? '');
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrap.appendChild(table);
        container.appendChild(wrap);
        continue;
      }
    }

    // Bullet or Numbered list
    const isUl = /^[-*•]\s+/.test(trimmed);
    const isOl = /^\d+[.)]\s+/.test(trimmed);
    if (isUl || isOl) {
      const listEl = document.createElement(isUl ? 'ul' : 'ol');
      listEl.className = isUl ? 'my-1.5 list-disc space-y-1 pl-5' : 'my-1.5 list-decimal space-y-1 pl-5';
      while (i < lines.length) {
        const lTrim = lines[i].trim();
        const matchItem = isUl ? /^[-*•]\s+(.+)$/.exec(lTrim) : /^\d+[.)]\s+(.+)$/.exec(lTrim);
        if (!matchItem) break;
        const li = document.createElement('li');
        appendInlineMarkdown(li, matchItem[1]);
        listEl.appendChild(li);
        i++;
      }
      container.appendChild(listEl);
      continue;
    }

    // Paragraph
    const p = document.createElement('p');
    p.className = 'my-1.5';
    appendInlineMarkdown(p, trimmed);
    container.appendChild(p);
    i++;
  }
}

async function consumeOpenAiSse(
  response: Response,
  onChunk: (fullText: string) => void,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let accumulated = '';
  let rafPending = false;

  const scheduleFlush = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      onChunk(accumulated);
    });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          accumulated += delta;
          scheduleFlush();
        }
      } catch {
        // ignore partial/keepalive line
      }
    }
  }

  onChunk(accumulated);
  return accumulated;
}

export function initViralLab(deps: ViralLabDeps) {
  const $ = <T = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;

  const btnViralMain = $<HTMLButtonElement>('#dl-btn-viral-main');
  const btnViralLabel = $('#dl-btn-viral-label');
  const btnJumpViral = $<HTMLButtonElement>('#dl-btn-jump-viral');
  const btnStartEmpty = $<HTMLButtonElement>('#viral-btn-start-empty');

  const emptyCard = $('#viral-empty-card');
  const workspace = $('#viral-workspace');

  const platformChip = $('#viral-platform-chip');
  const sourceChip = $('#viral-source-chip');
  const statsChip = $('#viral-stats-chip');
  const videoTitle = $('#viral-video-title');
  const videoMeta = $('#viral-video-meta');
  const btnCopyTranscript = $<HTMLButtonElement>('#viral-btn-copy-transcript');
  const btnDownloadSrt = $<HTMLButtonElement>('#viral-btn-download-srt');
  const btnToggleTranscript = $<HTMLButtonElement>('#viral-btn-toggle-transcript');
  const toggleTranscriptLabel = $('#viral-btn-toggle-transcript [data-toggle-label]');
  const transcriptWrap = $('#viral-transcript-wrap');
  const transcriptSegments = $('#viral-transcript-segments');

  const btnRerunXray = $<HTMLButtonElement>('#viral-btn-rerun-xray');
  const xrayStatus = $('#viral-xray-status');
  const xrayBody = $('#viral-xray-body');

  const industrySelect = $<HTMLSelectElement>('#viral-industry-select');
  const industryCustomWrap = $('#viral-industry-custom-wrap');
  const industryCustom = $<HTMLInputElement>('#viral-industry-custom');
  const customAngle = $<HTMLInputElement>('#viral-custom-angle');
  const btnGenerate = $<HTMLButtonElement>('#viral-btn-generate');
  const genStatus = $('#viral-gen-status');

  const outputWrap = $('#viral-output-wrap');
  const lintBadge = $('#viral-lint-badge');
  const btnToggleFindings = $<HTMLButtonElement>('#viral-btn-toggle-findings');
  const lintFindingsEl = $<HTMLUListElement>('#viral-lint-findings');
  const btnPolish = $<HTMLButtonElement>('#viral-btn-polish');
  const scriptBody = $('#viral-script-body');

  const btnCopyCapcut = $<HTMLButtonElement>('#viral-btn-copy-capcut');
  const btnCopyMd = $<HTMLButtonElement>('#viral-btn-copy-md');
  const btnShare = $<HTMLButtonElement>('#viral-btn-share');
  const shareBox = $('#viral-share-box');
  const shareLink = $<HTMLAnchorElement>('#viral-share-link');
  const btnCopyShare = $<HTMLButtonElement>('#viral-btn-copy-share');

  let currentTranscript: ClientTranscript | null = null;
  let currentXrayMd = '';
  let currentScriptMd = '';
  let currentFindings: VietProFinding[] = [];
  let transcribing = false;
  let generatingXray = false;
  let generatingScript = false;

  function getSelectedFormat(): string {
    const checked = document.querySelector<HTMLInputElement>('input[name="viral-format"]:checked');
    return checked?.value || 'tiktok-script';
  }

  function getSelectedIndustry(): string {
    if (!industrySelect) return '';
    if (industrySelect.value === '__custom__') {
      return industryCustom?.value.trim() || '';
    }
    return industrySelect.value.trim();
  }

  function renderTranscript(tr: ClientTranscript) {
    if (emptyCard) emptyCard.hidden = true;
    if (workspace) workspace.hidden = false;

    if (platformChip) {
      platformChip.textContent = cleanLabel(tr.platformLabel || tr.platform) || 'Video';
    }
    if (sourceChip) {
      const srcLabel = tr.sourceKind === 'subtitles' ? 'Phụ đề gốc' : 'Whisper AI';
      sourceChip.textContent = tr.cached ? `${srcLabel} · Bộ nhớ đệm` : srcLabel;
    }
    const wordCount = tr.transcriptText.split(/\s+/).filter(Boolean).length;
    const wpm = tr.duration > 5 ? Math.round((wordCount / tr.duration) * 60) : 0;
    if (statsChip) {
      statsChip.textContent = wpm > 0 ? `${wordCount} từ · ~${wpm} từ/phút` : `${wordCount} từ`;
    }
    if (videoTitle) videoTitle.textContent = tr.title || 'Video';
    if (videoMeta) {
      const metaParts = [
        tr.uploader ? `Kênh: ${tr.uploader}` : '',
        tr.duration > 0 ? `Thời lượng: ${formatTimestamp(tr.duration)}` : '',
        tr.language ? `Ngôn ngữ gốc: ${tr.language.toUpperCase()}` : '',
      ].filter(Boolean);
      videoMeta.textContent = metaParts.join(' · ');
    }

    if (transcriptSegments) {
      transcriptSegments.replaceChildren();
      if (tr.segments && tr.segments.length > 0) {
        for (const seg of tr.segments) {
          const row = document.createElement('div');
          row.className = 'flex items-baseline gap-2.5';
          const ts = document.createElement('span');
          ts.className = 'shrink-0 font-mono text-xs text-accent-ink';
          ts.textContent = `[${formatTimestamp(seg.start)}]`;
          const txt = document.createElement('span');
          txt.textContent = seg.text;
          row.appendChild(ts);
          row.appendChild(txt);
          transcriptSegments.appendChild(row);
        }
      } else {
        const p = document.createElement('p');
        p.textContent = tr.transcriptText;
        transcriptSegments.appendChild(p);
      }
    }
  }

  function updateVietProGate(md: string) {
    const res = computeVietProScore(md);
    currentFindings = res.findings;
    if (lintBadge) {
      lintBadge.textContent = cleanLabel(res.badgeLabel) || res.badgeLabel;
      lintBadge.style.color =
        res.tone === 'good' ? '#15803d' : res.tone === 'warn' ? '#b45309' : '#b91c1c';
    }
    if (btnToggleFindings && lintFindingsEl) {
      if (res.findings.length === 0) {
        btnToggleFindings.hidden = true;
        lintFindingsEl.hidden = true;
        lintFindingsEl.replaceChildren();
      } else {
        btnToggleFindings.hidden = false;
        btnToggleFindings.textContent = `Xem ${res.findings.length} điểm cảnh báo`;
        lintFindingsEl.replaceChildren();
        for (const f of res.findings.slice(0, 10)) {
          const li = document.createElement('li');
          li.textContent = `• [${f.id}] ${f.excerpt}${f.desc ? ` — ${f.desc}` : ''}`;
          lintFindingsEl.appendChild(li);
        }
      }
    }
  }

  async function runXrayAnalysis() {
    if (!currentTranscript || generatingXray) return;
    generatingXray = true;
    if (btnRerunXray) btnRerunXray.disabled = true;
    if (xrayStatus) xrayStatus.hidden = false;
    if (xrayBody) xrayBody.replaceChildren();

    try {
      const res = await fetch('/api/viral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'xray',
          videoHash: currentTranscript.videoHash,
          formatKey: 'tiktok-script',
          visitorId: deps.getVisitorId(),
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        deps.showAlert(errData.message || errData.error || 'Không thể chạy phân tích X-Quang lúc này.', true);
        return;
      }

      currentXrayMd = await consumeOpenAiSse(res, (partial) => {
        if (xrayBody) renderSafeMarkdown(xrayBody, partial);
      });
    } catch {
      deps.showAlert('Kết nối luồng phân tích X-Quang bị gián đoạn.', true);
    } finally {
      generatingXray = false;
      if (btnRerunXray) btnRerunXray.disabled = false;
      if (xrayStatus) xrayStatus.hidden = true;
    }
  }

  async function runScriptGenerate(action: 'rewrite' | 'polish' = 'rewrite') {
    if (!currentTranscript || generatingScript) return;
    if (action === 'polish' && !currentScriptMd.trim()) return;

    generatingScript = true;
    if (btnGenerate) btnGenerate.disabled = true;
    if (btnPolish) btnPolish.disabled = true;
    if (genStatus) {
      genStatus.hidden = false;
      genStatus.textContent =
        action === 'polish'
          ? 'Đang khử sạch vệt văn mẫu AI theo chuẩn Viết Pro…'
          : 'DeepSeek Flash đang viết kịch bản theo chuẩn Viết Pro…';
    }
    if (outputWrap) outputWrap.hidden = false;
    if (shareBox) shareBox.hidden = true;

    const findingsPayload =
      action === 'polish' ? currentFindings.map((f) => `[${f.id}] ${f.excerpt}`) : [];

    try {
      const res = await fetch('/api/viral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          videoHash: currentTranscript.videoHash,
          formatKey: getSelectedFormat(),
          industry: getSelectedIndustry(),
          customAngle: customAngle?.value.trim() || '',
          draftMarkdown: action === 'polish' ? currentScriptMd : '',
          lintFindings: findingsPayload,
          visitorId: deps.getVisitorId(),
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        deps.showAlert(errData.message || errData.error || 'Không thể sinh kịch bản lúc này.', true);
        return;
      }

      currentScriptMd = await consumeOpenAiSse(res, (partial) => {
        if (scriptBody) renderSafeMarkdown(scriptBody, partial);
      });
      updateVietProGate(currentScriptMd);
    } catch {
      deps.showAlert('Kết nối luồng sinh kịch bản bị gián đoạn. Bạn bấm tạo lại nhé.', true);
    } finally {
      generatingScript = false;
      if (btnGenerate) btnGenerate.disabled = false;
      if (btnPolish) btnPolish.disabled = false;
      if (genStatus) genStatus.hidden = true;
    }
  }

  async function startFromUrl(overrideUrl?: string) {
    if (transcribing) return;
    deps.showAlert('');
    const raw = (overrideUrl ?? deps.getUrlInput()).trim();
    if (!raw) {
      deps.switchToViralTab();
      deps.showAlert('Vui lòng dán đường dẫn 1 video (YouTube, TikTok, Reels, Douyin...) vào ô nhập phía trên.', true);
      return;
    }

    const check = validateSafeMediaUrl(raw);
    if (!check.ok) {
      deps.showAlert(check.error, true);
      return;
    }
    if (isPlaylistOrProfileUrl(check.url)) {
      deps.showAlert('Tính năng Mổ Xẻ Kịch Bản áp dụng cho từng video lẻ cụ thể (không áp dụng cho cả Playlist/Kênh).', true);
      return;
    }

    if (overrideUrl) deps.setUrlInput(check.url);
    deps.switchToViralTab();

    transcribing = true;
    if (btnViralMain) btnViralMain.disabled = true;
    if (btnStartEmpty) btnStartEmpty.disabled = true;
    if (btnViralLabel) btnViralLabel.textContent = 'ĐANG BÓC BĂNG…';

    if (emptyCard) emptyCard.hidden = true;
    if (workspace) workspace.hidden = false;
    if (videoTitle) videoTitle.textContent = 'Đang bóc băng lời thoại & nhận diện giọng nói AI…';
    if (videoMeta) videoMeta.textContent = 'Thường mất 1.5 – 5 giây tùy độ dài video';
    if (transcriptSegments) {
      transcriptSegments.replaceChildren();
      const loadingP = document.createElement('p');
      loadingP.className = 'text-xs font-medium text-muted';
      loadingP.textContent = 'Đang trích xuất phụ đề hoặc tách âm thanh 32kbps siêu nhẹ gửi tới Whisper Turbo…';
      transcriptSegments.appendChild(loadingP);
    }
    if (outputWrap) outputWrap.hidden = true;
    if (shareBox) shareBox.hidden = true;
    currentXrayMd = '';
    currentScriptMd = '';

    try {
      const res = await fetch('/api/viral/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: check.url,
          visitorId: deps.getVisitorId(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        transcript?: ClientTranscript;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.transcript) {
        if (workspace) workspace.hidden = true;
        if (emptyCard) emptyCard.hidden = false;
        deps.showAlert(data.message || data.error || 'Không thể bóc băng video này.', true);
        return;
      }

      currentTranscript = data.transcript;
      renderTranscript(data.transcript);

      // Automatically trigger Viral DNA X-Ray immediately!
      void runXrayAnalysis();
    } catch {
      if (workspace) workspace.hidden = true;
      if (emptyCard) emptyCard.hidden = false;
      deps.showAlert('Mất kết nối tạm thời khi bóc băng video.', true);
    } finally {
      transcribing = false;
      if (btnViralMain) btnViralMain.disabled = false;
      if (btnStartEmpty) btnStartEmpty.disabled = false;
      if (btnViralLabel) btnViralLabel.textContent = 'MỔ XẺ & VIẾT KỊCH BẢN';
    }
  }

  // --- Wire UI Events ---
  btnViralMain?.addEventListener('click', () => void startFromUrl());
  btnStartEmpty?.addEventListener('click', () => void startFromUrl());
  btnJumpViral?.addEventListener('click', () => void startFromUrl());
  btnRerunXray?.addEventListener('click', () => void runXrayAnalysis());
  btnGenerate?.addEventListener('click', () => void runScriptGenerate('rewrite'));
  btnPolish?.addEventListener('click', () => void runScriptGenerate('polish'));

  industrySelect?.addEventListener('change', () => {
    if (industryCustomWrap) {
      industryCustomWrap.hidden = industrySelect.value !== '__custom__';
      if (industrySelect.value === '__custom__') industryCustom?.focus();
    }
  });

  btnToggleTranscript?.addEventListener('click', () => {
    if (!transcriptWrap || !btnToggleTranscript) return;
    const nextHidden = !transcriptWrap.hidden;
    transcriptWrap.hidden = nextHidden;
    btnToggleTranscript.setAttribute('aria-expanded', String(!nextHidden));
    const labelText = nextHidden ? 'Hiện lời thoại' : 'Ẩn lời thoại';
    if (toggleTranscriptLabel) {
      toggleTranscriptLabel.textContent = labelText;
    } else {
      btnToggleTranscript.textContent = labelText;
    }
  });

  btnToggleFindings?.addEventListener('click', () => {
    if (!lintFindingsEl) return;
    lintFindingsEl.hidden = !lintFindingsEl.hidden;
  });

  btnCopyTranscript?.addEventListener('click', async () => {
    if (!currentTranscript) return;
    const formatted =
      currentTranscript.segments.length > 0
        ? currentTranscript.segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n')
        : currentTranscript.transcriptText;
    try {
      await navigator.clipboard.writeText(formatted);
      deps.showAlert('Đã sao chép toàn bộ lời thoại có mốc thời gian vào bộ nhớ tạm!');
    } catch {
      deps.showAlert('Không thể tự động sao chép trên trình duyệt này.', true);
    }
  });

  btnDownloadSrt?.addEventListener('click', () => {
    if (!currentTranscript) return;
    const srt = segmentsToSrt(
      currentTranscript.segments.length > 0
        ? currentTranscript.segments
        : [{ start: 0, end: Math.max(5, currentTranscript.duration || 10), text: currentTranscript.transcriptText }],
    );
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const safeName = (currentTranscript.title || 'transcript')
      .replace(/["\\/:*?<>|]+/g, '_')
      .slice(0, 60)
      .trim();
    a.download = `${safeName || 'transcript'}.srt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      a.remove();
    }, 1000);
  });

  btnCopyCapcut?.addEventListener('click', async () => {
    if (!currentScriptMd) return;
    const spoken = extractCapCutTeleprompterText(currentScriptMd);
    try {
      await navigator.clipboard.writeText(spoken);
      deps.showAlert('Đã sao chép riêng phần lời đọc sạch sẽ — bạn có thể dán thẳng vào CapCut Teleprompter để quay!');
    } catch {
      deps.showAlert('Trình duyệt chặn quyền bộ nhớ tạm.', true);
    }
  });

  btnCopyMd?.addEventListener('click', async () => {
    if (!currentScriptMd) return;
    try {
      await navigator.clipboard.writeText(currentScriptMd);
      deps.showAlert('Đã sao chép toàn bộ kịch bản Markdown vào bộ nhớ tạm!');
    } catch {
      deps.showAlert('Trình duyệt chặn quyền bộ nhớ tạm.', true);
    }
  });

  btnShare?.addEventListener('click', async () => {
    if (!currentTranscript || (!currentScriptMd && !currentXrayMd)) return;
    if (btnShare) btnShare.disabled = true;
    try {
      const res = await fetch('/api/viral/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoHash: currentTranscript.videoHash,
          formatKey: currentScriptMd ? getSelectedFormat() : 'xray',
          industry: getSelectedIndustry(),
          xrayMarkdown: currentXrayMd,
          scriptMarkdown: currentScriptMd,
          visitorId: deps.getVisitorId(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { shareUrl?: string; message?: string; error?: string };
      if (!res.ok || !data.shareUrl) {
        deps.showAlert(data.message || data.error || 'Không thể tạo link chia sẻ.', true);
        return;
      }
      if (shareBox && shareLink) {
        shareBox.hidden = false;
        shareLink.href = data.shareUrl;
        shareLink.textContent = data.shareUrl;
      }
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        deps.showAlert('Đã tạo và sao chép đường dẫn báo cáo chia sẻ công khai!');
      } catch {
        deps.showAlert('Đã tạo đường dẫn chia sẻ ở bên dưới!');
      }
    } catch {
      deps.showAlert('Lỗi kết nối khi tạo link chia sẻ.', true);
    } finally {
      if (btnShare) btnShare.disabled = false;
    }
  });

  btnCopyShare?.addEventListener('click', async () => {
    const href = shareLink?.textContent || '';
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      deps.showAlert('Đã sao chép đường dẫn chia sẻ!');
    } catch {
      // ignore
    }
  });

  return { startFromUrl };
}
