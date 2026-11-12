// Client-side controller for /tai-video: 1-Click presets, multi-URL batch, playlist/profile selector,
// real-time progress polling, detailed format table, and localStorage download history.
import {
  detectPlatform,
  extractUrlsFromInput,
  isPlaylistOrProfileUrl,
  type Platform,
  validateSafeMediaUrl,
} from '../lib/dl-platforms';
import { initViralLab } from './viral-lab';

interface DlChoice {
  formatId: string;
  kind: 'video' | 'audio';
  resolutionTag: string;
  label: string;
  sizeBytes?: number;
}

interface DlEntry {
  id?: string;
  url: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  platform?: Platform;
  itemTicket?: string;
  selected?: boolean;
  statusText?: string;
}

interface ResolveResponse {
  mode: 'single' | 'playlist' | 'batch';
  url?: string;
  title?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  isVertical?: boolean;
  platform?: Platform;
  choices?: DlChoice[];
  itemTicket?: string;
  entries?: DlEntry[];
  tier?: 'public' | 'admin';
  limits?: {
    maxHeight: number;
    maxFilesizeMB: number;
    maxBatchItems: number;
  };
  error?: string;
  message?: string;
}

interface TaskStatusResponse {
  id: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress?: {
    downloadedBytes: number;
    totalBytes?: number;
    speed?: number;
    eta?: number;
    percent: number;
  };
  filename?: string;
  sizeBytes?: number;
  error?: string;
  streamTicket?: string;
  streamUrl?: string;
  message?: string;
}

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  platformLabel: string;
  platformIcon?: string;
  formatLabel: string;
  downloadedAt: string;
}

type TabKey = 'queue' | 'viral' | 'formats' | 'history';
const TAB_ORDER: readonly TabKey[] = ['queue', 'viral', 'formats', 'history'];

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_PATHS = {
  bolt: 'M13 2 4.5 13.5h6.5L10 22l9.5-11.5H13L13 2Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  dna: 'M7 3c0 4.5 10 4.5 10 9s-10 4.5-10 9M17 3c0 4.5-10 4.5-10 9s10 4.5 10 9M8.5 6.5h7M8.5 17.5h7M9.5 12h5',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2',
  external: 'M14 4h6v6m0-6-9.5 9.5M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4m-4 4h4m-4 4h4m8-8h4m-4 4h4m-4 4h4',
  music: 'M9 18V6l11-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm11-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.6L4 8m0-4v4h4m-4 5a8 8 0 0 0 14.5 4.6L20 16m0 4v-4h-4',
} as const;

function createSvgIcon(name: keyof typeof ICON_PATHS, size = 14): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.appendChild(path);
  return svg;
}

function cleanLabel(raw?: string): string {
  return (raw || '').replace(/^[^\p{L}\p{N}]+\s*/u, '').trim();
}

const VISITOR_KEY = 'tqd_visitor_id';
const HISTORY_KEY = 'tqd_dl_history_v1';
const SPEED_KEY = 'tqd_dl_last_speed_bps';
const MAX_HISTORY = 50;
const FALLBACK_ESTIMATE_BPS = 4 * 1024 * 1024;

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return '00000000-0000-4000-8000-000000000000';
  }
}

function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return '';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMBps(bytesPerSec?: number): string {
  if (!bytesPerSec || !Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '-- MB/s';
  const mb = bytesPerSec / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB/s`;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

const statusDot = $('#dl-status-dot');
const statusText = $('#dl-status-text');
const speedPill = $('#dl-speed-pill');
const tierBadge = $('#dl-tier-badge');
const platformBadge = $('#dl-platform-badge');
const platformLabelEl = $('#dl-platform-badge [data-platform-label]');

const singleWrap = $('#dl-single-wrap');
const batchWrap = $('#dl-batch-wrap');
const inputUrl = $<HTMLInputElement>('#dl-input-url');
const inputBatch = $<HTMLTextAreaElement>('#dl-input-batch');
const batchCount = $('#dl-batch-count');
const btnBatchToggle = $<HTMLButtonElement>('#dl-btn-batch-toggle');
const batchToggleLabel = $('#dl-batch-toggle-label');

const btnPaste = $<HTMLButtonElement>('#dl-btn-paste');
const btnClear = $<HTMLButtonElement>('#dl-btn-clear');
const btnMain = $<HTMLButtonElement>('#dl-btn-main');
const btnMainLabel = $('#dl-btn-main-label');
const btnBatchClear = $<HTMLButtonElement>('#dl-btn-batch-clear');
const btnBatchSubmit = $<HTMLButtonElement>('#dl-btn-batch-submit');

const chkPlaylist = $<HTMLInputElement>('#dl-chk-playlist');
const chkCompat = $<HTMLInputElement>('#dl-chk-compat');
const alertBox = $('#dl-alert');

const tablistEl = $<HTMLElement>('[role="tablist"]');
const tabBtnQueue = $<HTMLButtonElement>('#dl-tab-btn-queue');
const tabBtnViral = $<HTMLButtonElement>('#dl-tab-btn-viral');
const tabBtnFormats = $<HTMLButtonElement>('#dl-tab-btn-formats');
const tabBtnHistory = $<HTMLButtonElement>('#dl-tab-btn-history');
const panelQueue = $('#dl-panel-queue');
const panelViral = $('#dl-panel-viral');
const panelFormats = $('#dl-panel-formats');
const panelHistory = $('#dl-panel-history');

const queueCountBadge = $('#dl-queue-count');
const formatsCountBadge = $('#dl-formats-count');
const historyCountBadge = $('#dl-history-count');

const activeCard = $('#dl-active-card');
const previewThumb = $<HTMLImageElement>('#dl-preview-thumb');
const previewPlatform = $('#dl-preview-platform');
const previewKind = $('#dl-preview-kind');
const previewTitle = $('#dl-preview-title');
const previewMeta = $('#dl-preview-meta');
const progressStatus = $('#dl-progress-status');
const progressPercent = $('#dl-progress-percent');
const progressSpeed = $('#dl-progress-speed');
const progressEta = $('#dl-progress-eta');
const progressBar = $('#dl-progress-bar');
const directLink = $<HTMLAnchorElement>('#dl-direct-link');
const btnSwitchFormats = $<HTMLButtonElement>('#dl-btn-switch-formats');

const collectionCard = $('#dl-collection-card');
const collectionTitle = $('#dl-collection-title');
const collectionSubtitle = $('#dl-collection-subtitle');
const collectionList = $<HTMLUListElement>('#dl-collection-list');
const btnSelectAll = $<HTMLButtonElement>('#dl-btn-select-all');
const btnSelectNone = $<HTMLButtonElement>('#dl-btn-select-none');
const btnDownloadSelected = $<HTMLButtonElement>('#dl-btn-download-selected');
const queueEmpty = $('#dl-queue-empty');

const formatsTitle = $('#dl-formats-title');
const formatsEmpty = $('#dl-formats-empty');
const formatsTableWrap = $('#dl-formats-table-wrap');
const formatsTbody = $<HTMLTableSectionElement>('#dl-formats-tbody');

const historyEmpty = $('#dl-history-empty');
const historyList = $<HTMLUListElement>('#dl-history-list');
const btnClearHistory = $<HTMLButtonElement>('#dl-btn-clear-history');

let isBatchMode = false;
let collectionEntries: DlEntry[] = [];
let busy = false;
let daemonOnlineState = false;
let lastSpeedBps = Number(localStorage.getItem(SPEED_KEY) || 0) || 0;

function updateSpeedPill(bps?: number) {
  if (bps && bps > 0) {
    lastSpeedBps = bps;
    daemonOnlineState = true;
    try {
      localStorage.setItem(SPEED_KEY, String(Math.round(bps)));
    } catch {
      // ignore storage quota
    }
  }
  if (!speedPill) return;
  if (daemonOnlineState && lastSpeedBps > 0) {
    speedPill.hidden = false;
    speedPill.textContent = `Tốc độ: ${formatMBps(lastSpeedBps)}`;
  } else {
    speedPill.hidden = true;
  }
}

function showAlert(msg: string, isError = false) {
  if (!alertBox) return;
  if (!msg) {
    alertBox.hidden = true;
    alertBox.textContent = '';
    return;
  }
  alertBox.hidden = false;
  alertBox.textContent = msg;
  alertBox.style.borderColor = isError ? '#b91c1c' : 'var(--color-accent)';
  alertBox.style.color = isError ? '#991b1b' : 'var(--color-ink)';
}

function switchTab(tab: TabKey, focusBtn = false) {
  const map: Record<TabKey, readonly [HTMLButtonElement | null, HTMLElement | null]> = {
    queue: [tabBtnQueue, panelQueue],
    viral: [tabBtnViral, panelViral],
    formats: [tabBtnFormats, panelFormats],
    history: [tabBtnHistory, panelHistory],
  };

  for (const key of TAB_ORDER) {
    const [btn, panel] = map[key];
    const active = key === tab;
    if (btn) {
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active && focusBtn) btn.focus();
    }
    if (panel) panel.hidden = !active;
  }
}

function getSelectedPreset(): 'best' | '720' | 'audio' | 'pick' {
  const checked = document.querySelector<HTMLInputElement>('input[name="dl-preset"]:checked');
  const val = checked?.value;
  if (val === '720' || val === 'audio' || val === 'pick') return val;
  return 'best';
}

function updateMainButtonLabel() {
  if (!btnMainLabel) return;
  const preset = getSelectedPreset();
  if (preset === 'pick') {
    btnMainLabel.textContent = 'QUÉT ĐỘ PHÂN GIẢI';
  } else if (preset === 'audio') {
    btnMainLabel.textContent = 'TẢI NHẠC MP3';
  } else if (preset === '720') {
    btnMainLabel.textContent = 'TẢI NHANH 720P';
  } else {
    btnMainLabel.textContent = 'TẢI NGAY';
  }
}

function setPlatformText(text: string) {
  if (platformLabelEl) {
    platformLabelEl.textContent = text;
  } else if (platformBadge) {
    platformBadge.textContent = text;
  }
}

function updatePlatformBadgeFromInput() {
  if (!platformBadge) return;
  if (isBatchMode) {
    const urls = extractUrlsFromInput(inputBatch?.value ?? '');
    if (batchCount) {
      batchCount.textContent = `Đã nhận diện ${urls.length} đường dẫn hợp lệ`;
    }
    setPlatformText(`${urls.length} đường dẫn`);
    return;
  }

  const raw = inputUrl?.value.trim() ?? '';
  if (!raw) {
    setPlatformText('Tự động nhận diện');
    return;
  }
  const check = validateSafeMediaUrl(raw);
  if (!check.ok) {
    setPlatformText('Link chưa hợp lệ');
    return;
  }
  const p = detectPlatform(check.url);
  setPlatformText(cleanLabel(p.label) || 'Media');
  if (chkPlaylist && isPlaylistOrProfileUrl(check.url)) {
    chkPlaylist.checked = true;
  }
}

function triggerBrowserDownload(streamUrl: string) {
  const a = document.createElement('a');
  a.href = streamUrl;
  a.setAttribute('download', '');
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

// --- History (localStorage) ---

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryItem(item: HistoryItem) {
  try {
    const current = loadHistory().filter((x) => x.url !== item.url || x.formatLabel !== item.formatLabel);
    const updated = [item, ...current].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    renderHistory();
  } catch {
    // ignore storage errors
  }
}

function renderHistory() {
  const items = loadHistory();
  if (historyCountBadge) historyCountBadge.textContent = String(items.length);
  if (!historyList || !historyEmpty) return;

  if (items.length === 0) {
    historyEmpty.hidden = false;
    historyList.hidden = true;
    historyList.replaceChildren();
    return;
  }

  historyEmpty.hidden = true;
  historyList.hidden = false;
  historyList.replaceChildren();

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'flex flex-wrap items-center justify-between gap-3 py-3 text-sm';

    const left = document.createElement('div');
    left.className = 'flex min-w-0 flex-1 flex-col gap-1';

    const titleRow = document.createElement('div');
    titleRow.className = 'flex flex-wrap items-center gap-2';

    const badge = document.createElement('span');
    badge.className = 'lux-chip px-2.5 py-0.5 text-xs font-semibold';
    badge.textContent = cleanLabel(item.platformLabel) || 'Video';

    const fmt = document.createElement('span');
    fmt.className = 'font-mono text-xs text-muted';
    fmt.textContent = `${item.formatLabel} · ${item.downloadedAt}`;

    titleRow.appendChild(badge);
    titleRow.appendChild(fmt);

    const titleEl = document.createElement('p');
    titleEl.className = 'truncate font-semibold text-ink';
    titleEl.textContent = item.title;

    left.appendChild(titleRow);
    left.appendChild(titleEl);

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center gap-2';

    const openLink = document.createElement('a');
    openLink.href = item.url;
    openLink.target = '_blank';
    openLink.rel = 'noopener';
    openLink.className =
      'dl-btn-secondary inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold no-underline';
    openLink.appendChild(createSvgIcon('external', 13));
    const openSpan = document.createElement('span');
    openSpan.textContent = 'Link gốc';
    openLink.appendChild(openSpan);

    const redownloadBtn = document.createElement('button');
    redownloadBtn.type = 'button';
    redownloadBtn.className =
      'dl-btn-secondary inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold';
    redownloadBtn.appendChild(createSvgIcon('refresh', 13));
    const redoSpan = document.createElement('span');
    redoSpan.textContent = 'Tải lại';
    redownloadBtn.appendChild(redoSpan);
    redownloadBtn.addEventListener('click', () => {
      if (isBatchMode && btnBatchToggle) btnBatchToggle.click();
      if (inputUrl) {
        inputUrl.value = item.url;
        updatePlatformBadgeFromInput();
        void handleSingleOrPlaylistSubmit();
      }
    });

    const viralBtn = document.createElement('button');
    viralBtn.type = 'button';
    viralBtn.className =
      'dl-btn-viral inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold';
    viralBtn.appendChild(createSvgIcon('dna', 13));
    const viralSpan = document.createElement('span');
    viralSpan.textContent = 'Mổ xẻ';
    viralBtn.appendChild(viralSpan);
    viralBtn.addEventListener('click', () => {
      if (isBatchMode && btnBatchToggle) btnBatchToggle.click();
      void viralLab.startFromUrl(item.url);
    });

    actions.appendChild(openLink);
    actions.appendChild(viralBtn);
    actions.appendChild(redownloadBtn);
    li.appendChild(left);
    li.appendChild(actions);
    historyList.appendChild(li);
  }
}

// --- Formats Table (Tab 3) ---

function renderFormatsTable(data: ResolveResponse) {
  const choices = data.choices ?? [];
  if (formatsCountBadge) formatsCountBadge.textContent = String(choices.length);
  if (!formatsTbody || !formatsEmpty || !formatsTableWrap) return;

  if (formatsTitle && data.title) {
    formatsTitle.textContent = data.title;
  }

  if (choices.length === 0 || !data.itemTicket) {
    formatsEmpty.hidden = false;
    formatsTableWrap.hidden = true;
    formatsTbody.replaceChildren();
    return;
  }

  formatsEmpty.hidden = true;
  formatsTableWrap.hidden = false;
  formatsTbody.replaceChildren();

  const refSpeedBps = lastSpeedBps > 0 ? lastSpeedBps : FALLBACK_ESTIMATE_BPS;

  for (const choice of choices) {
    const tr = document.createElement('tr');

    const tdKind = document.createElement('td');
    tdKind.className = 'whitespace-nowrap py-3 pr-4';
    const kindChip = document.createElement('span');
    kindChip.className = 'lux-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold';
    kindChip.appendChild(createSvgIcon(choice.kind === 'audio' ? 'music' : 'film', 13));
    const kindSpan = document.createElement('span');
    kindSpan.textContent = choice.kind === 'audio' ? 'MP3 Audio' : 'MP4 Video';
    kindChip.appendChild(kindSpan);
    tdKind.appendChild(kindChip);

    const tdLabel = document.createElement('td');
    tdLabel.className = 'py-3 pr-4 font-medium text-ink';
    tdLabel.textContent = cleanLabel(choice.label) || choice.label;

    const tdEst = document.createElement('td');
    tdEst.className = 'whitespace-nowrap py-3 pr-4 text-xs tabular-nums text-muted';
    if (choice.sizeBytes && refSpeedBps > 0) {
      const estSec = Math.max(2, Math.round(choice.sizeBytes / refSpeedBps));
      tdEst.textContent = `~${estSec} giây`;
    } else {
      tdEst.textContent = 'Tức thì';
    }

    const tdAction = document.createElement('td');
    tdAction.className = 'whitespace-nowrap py-3 text-right';
    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'btn-gold cursor-pointer border-0 text-xs';
    dlBtn.appendChild(createSvgIcon('download', 14));
    const dlSpan = document.createElement('span');
    dlSpan.textContent = 'Tải ngay';
    dlBtn.appendChild(dlSpan);
    dlBtn.addEventListener('click', () => {
      switchTab('queue');
      void startDownloadFlow({
        itemTicket: data.itemTicket!,
        url: data.url || '',
        title: data.title || 'Video',
        platform: data.platform || { key: 'generic', label: 'Video', icon: '', mediaKind: 'video' },
        formatId: choice.formatId,
        kind: choice.kind,
        formatLabel: choice.resolutionTag.toUpperCase(),
      });
    });
    tdAction.appendChild(dlBtn);

    tr.appendChild(tdKind);
    tr.appendChild(tdLabel);
    tr.appendChild(tdEst);
    tr.appendChild(tdAction);
    formatsTbody.appendChild(tr);
  }
}

// --- Active Preview & Progress (Tab 1) ---

function showSinglePreview(data: ResolveResponse) {
  if (!activeCard) return;
  activeCard.hidden = false;
  if (queueEmpty) queueEmpty.hidden = true;

  if (previewThumb) {
    previewThumb.src = data.thumbnail || '/og/tai-video.png';
    previewThumb.alt = data.title || 'Ảnh thu nhỏ video';
  }
  if (previewPlatform && data.platform) {
    previewPlatform.textContent = cleanLabel(data.platform.label) || 'Video';
  }
  if (previewKind) {
    previewKind.textContent = data.isVertical ? 'Shorts 9:16' : 'Video 16:9';
  }
  if (previewTitle) {
    previewTitle.textContent = data.title || 'Video';
  }
  if (previewMeta) {
    const parts = [data.uploader, formatDuration(data.duration)].filter(Boolean);
    previewMeta.textContent = parts.join(' · ');
  }
  if (progressStatus) progressStatus.textContent = 'Đã phân tích xong — sẵn sàng tải';
  if (progressPercent) progressPercent.textContent = '0%';
  if (progressSpeed) progressSpeed.textContent = '-- MB/s';
  if (progressEta) progressEta.textContent = 'ETA --';
  if (progressBar) progressBar.style.width = '0%';
  if (directLink) directLink.hidden = true;
}

async function startDownloadFlow(opts: {
  itemTicket: string;
  url: string;
  title: string;
  platform: Platform;
  formatId: string;
  kind: 'video' | 'audio';
  formatLabel: string;
  onRowStatus?: (text: string) => void;
}): Promise<boolean> {
  if (activeCard && activeCard.hidden && collectionCard?.hidden) {
    activeCard.hidden = false;
  }
  if (directLink) directLink.hidden = true;
  if (progressStatus) progressStatus.textContent = `Đang khởi tạo tải (${opts.formatLabel})…`;
  if (progressBar) progressBar.style.width = '5%';
  opts.onRowStatus?.('Đang chuẩn bị…');

  let prepRes: Response;
  try {
    prepRes = await fetch('/api/dl/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemTicket: opts.itemTicket,
        title: opts.title,
        formatId: opts.formatId,
        kind: opts.kind,
        compatibilityMode: chkCompat ? chkCompat.checked : true,
        visitorId: getVisitorId(),
      }),
    });
  } catch {
    showAlert('Không thể kết nối tới máy chủ tải video.', true);
    opts.onRowStatus?.('Lỗi kết nối');
    return false;
  }

  const prepData = (await prepRes.json().catch(() => ({}))) as {
    taskId?: string;
    taskTicket?: string;
    message?: string;
    error?: string;
  };

  if (!prepRes.ok || !prepData.taskId || !prepData.taskTicket) {
    const msg = prepData.message || prepData.error || 'Không thể khởi tạo lượt tải.';
    showAlert(msg, true);
    if (progressStatus) progressStatus.textContent = msg;
    opts.onRowStatus?.('Từ chối');
    return false;
  }

  const { taskId, taskTicket } = prepData;
  for (let attempt = 0; attempt < 480; attempt++) {
    await new Promise((r) => setTimeout(r, 950));
    let pollRes: Response;
    try {
      pollRes = await fetch(`/api/dl/task/${encodeURIComponent(taskId)}?ticket=${encodeURIComponent(taskTicket)}`);
    } catch {
      continue;
    }

    const taskData = (await pollRes.json().catch(() => null)) as TaskStatusResponse | null;
    if (!pollRes.ok || !taskData) {
      showAlert(taskData?.message || 'Không thể đọc trạng thái tác vụ tải.', true);
      opts.onRowStatus?.('Lỗi');
      return false;
    }

    const pct = taskData.progress?.percent ?? 0;
    const speed = taskData.progress?.speed;
    const eta = taskData.progress?.eta;

    if (speed && speed > 0) updateSpeedPill(speed);
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressSpeed) progressSpeed.textContent = formatMBps(speed);
    if (progressEta) progressEta.textContent = eta !== undefined ? `ETA ${Math.ceil(eta)}s` : 'ETA --';
    if (progressBar) progressBar.style.width = `${Math.max(8, pct)}%`;

    if (taskData.status === 'queued') {
      if (progressStatus) progressStatus.textContent = 'Đang xếp hàng chờ xử lý…';
      opts.onRowStatus?.('Chờ lượt…');
    } else if (taskData.status === 'downloading') {
      if (progressStatus) progressStatus.textContent = `Đang tải luồng dữ liệu (${pct}%)…`;
      opts.onRowStatus?.(`Đang tải ${pct}%`);
    } else if (taskData.status === 'processing') {
      if (progressStatus) progressStatus.textContent = 'Đang ghép H.264 + AAC (ffmpeg faststart)…';
      if (progressBar) progressBar.style.width = '96%';
      opts.onRowStatus?.('Đang ghép MP4…');
    } else if (taskData.status === 'completed' && taskData.streamUrl) {
      if (progressStatus) progressStatus.textContent = 'Hoàn tất! Đang truyền file về máy của bạn…';
      if (progressPercent) progressPercent.textContent = '100%';
      if (progressBar) progressBar.style.width = '100%';
      opts.onRowStatus?.('Đã tải xong');

      if (directLink) {
        directLink.href = taskData.streamUrl;
        directLink.hidden = false;
      }

      triggerBrowserDownload(taskData.streamUrl);

      saveHistoryItem({
        id: taskId,
        url: opts.url,
        title: opts.title,
        platformLabel: cleanLabel(opts.platform.label) || 'Video',
        formatLabel: opts.formatLabel,
        downloadedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
      return true;
    } else if (taskData.status === 'failed') {
      const errMsg = taskData.error || 'Tải video không thành công.';
      showAlert(errMsg, true);
      if (progressStatus) progressStatus.textContent = errMsg;
      opts.onRowStatus?.('Lỗi tải');
      return false;
    }
  }

  showAlert('Quá thời gian chờ tải video.', true);
  opts.onRowStatus?.('Quá hạn chờ');
  return false;
}

// --- Playlist / Profile / Batch Queue Rendering ---

function renderCollectionQueue(data: ResolveResponse) {
  collectionEntries = (data.entries ?? []).map((e) => ({
    ...e,
    selected: true,
    statusText: 'Sẵn sàng',
  }));

  if (queueCountBadge) queueCountBadge.textContent = String(collectionEntries.length);
  if (!collectionCard || !collectionList) return;

  collectionCard.hidden = false;
  if (queueEmpty) queueEmpty.hidden = true;
  if (collectionTitle) {
    collectionTitle.textContent = data.title || `Danh sách (${collectionEntries.length} mục)`;
  }
  if (collectionSubtitle) {
    collectionSubtitle.textContent = `Đã chọn ${collectionEntries.filter((x) => x.selected).length}/${collectionEntries.length} mục · Sẽ tải theo chế độ nhanh đang chọn ở trên`;
  }

  collectionList.replaceChildren();

  collectionEntries.forEach((entry, idx) => {
    const li = document.createElement('li');
    li.className = 'flex flex-wrap items-center justify-between gap-3 py-3 text-sm';

    const left = document.createElement('label');
    left.className = 'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2';

    // 44x44 accessible checkbox wrapper
    const chkWrap = document.createElement('span');
    chkWrap.className = 'relative inline-grid h-11 w-11 shrink-0 place-items-center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(entry.selected);
    checkbox.className = 'peer absolute inset-0 m-0 h-11 w-11 cursor-pointer opacity-0';
    checkbox.addEventListener('change', () => {
      entry.selected = checkbox.checked;
      if (collectionSubtitle) {
        collectionSubtitle.textContent = `Đã chọn ${collectionEntries.filter((x) => x.selected).length}/${collectionEntries.length} mục`;
      }
    });

    const chkVisual = document.createElement('span');
    chkVisual.className =
      'grid h-5 w-5 place-items-center rounded border border-champagne bg-panel text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent';
    chkVisual.appendChild(createSvgIcon('check', 13));

    chkWrap.appendChild(checkbox);
    chkWrap.appendChild(chkVisual);

    const num = document.createElement('span');
    num.className = 'w-6 font-mono text-xs text-muted';
    num.textContent = `${idx + 1}.`;

    const badge = document.createElement('span');
    badge.className = 'lux-chip px-2 py-0.5 text-xs font-semibold';
    badge.textContent = cleanLabel(entry.platform?.label) || 'Media';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'truncate font-medium text-ink';
    titleSpan.textContent = entry.title;

    left.appendChild(chkWrap);
    left.appendChild(num);
    left.appendChild(badge);
    left.appendChild(titleSpan);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2.5';

    if (entry.duration) {
      const dur = document.createElement('span');
      dur.className = 'font-mono text-xs text-muted';
      dur.textContent = formatDuration(entry.duration);
      right.appendChild(dur);
    }

    const statusBadge = document.createElement('span');
    statusBadge.className = 'lux-chip px-2.5 py-0.5 text-xs font-medium';
    statusBadge.textContent = entry.statusText || 'Sẵn sàng';

    const singleBtn = document.createElement('button');
    singleBtn.type = 'button';
    singleBtn.className =
      'dl-btn-secondary inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold';
    singleBtn.appendChild(createSvgIcon('bolt', 13));
    const singleSpan = document.createElement('span');
    singleSpan.textContent = 'Tải';
    singleBtn.appendChild(singleSpan);
    singleBtn.addEventListener('click', () => {
      if (!entry.itemTicket) return;
      const preset = getSelectedPreset();
      const kind = preset === 'audio' ? 'audio' : 'video';
      const formatId = preset === 'audio' ? 'audio' : preset === '720' ? '720' : 'best';
      const formatLabel = preset === 'audio' ? 'MP3' : preset === '720' ? '720P' : 'BEST';
      void startDownloadFlow({
        itemTicket: entry.itemTicket,
        url: entry.url,
        title: entry.title,
        platform: entry.platform || { key: 'generic', label: 'Video', icon: '', mediaKind: 'video' },
        formatId,
        kind,
        formatLabel,
        onRowStatus: (txt) => {
          statusBadge.textContent = txt;
        },
      });
    });

    (entry as DlEntry & { _setStatus?: (t: string) => void })._setStatus = (txt: string) => {
      statusBadge.textContent = txt;
    };

    right.appendChild(statusBadge);
    right.appendChild(singleBtn);
    li.appendChild(left);
    li.appendChild(right);
    collectionList.appendChild(li);
  });
}

function chooseFormatFromPreset(choices: DlChoice[], preset: 'best' | '720' | 'audio'): {
  formatId: string;
  kind: 'video' | 'audio';
  formatLabel: string;
} {
  if (preset === 'audio') {
    return { formatId: 'audio', kind: 'audio', formatLabel: 'MP3 320kbps' };
  }
  const videos = choices.filter((c) => c.kind === 'video');
  if (preset === '720') {
    const match720 =
      videos.find((c) => c.resolutionTag === '720p' || c.formatId === '720') ||
      videos.find((c) => Number.parseInt(c.resolutionTag, 10) <= 720) ||
      videos[0];
    if (match720) {
      return { formatId: match720.formatId, kind: 'video', formatLabel: match720.resolutionTag.toUpperCase() };
    }
    return { formatId: '720', kind: 'video', formatLabel: '720P' };
  }
  const topVideo = videos[0];
  if (topVideo) {
    return { formatId: topVideo.formatId, kind: 'video', formatLabel: topVideo.resolutionTag.toUpperCase() };
  }
  return { formatId: 'best', kind: 'video', formatLabel: 'BEST MP4' };
}

async function handleSingleOrPlaylistSubmit(urlsOverride?: string[]) {
  if (busy) return;
  showAlert('');

  const urls = urlsOverride ?? (inputUrl?.value.trim() ? [inputUrl.value.trim()] : []);
  if (urls.length === 0) {
    showAlert('Vui lòng dán đường dẫn video hoặc danh sách phát trước khi bấm tải.', true);
    inputUrl?.focus();
    return;
  }

  for (const u of urls) {
    const check = validateSafeMediaUrl(u);
    if (!check.ok) {
      showAlert(check.error, true);
      return;
    }
  }

  busy = true;
  if (btnMain) btnMain.disabled = true;
  if (btnBatchSubmit) btnBatchSubmit.disabled = true;
  const oldLabel = btnMainLabel?.textContent ?? 'TẢI NGAY';
  if (btnMainLabel) btnMainLabel.textContent = 'ĐANG PHÂN TÍCH…';

  try {
    const res = await fetch('/api/dl/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        allowPlaylist: Boolean(chkPlaylist?.checked),
        visitorId: getVisitorId(),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as ResolveResponse;
    if (!res.ok) {
      showAlert(data.message || data.error || 'Không thể phân tích đường dẫn này.', true);
      return;
    }

    if (data.mode === 'playlist' || data.mode === 'batch') {
      if (activeCard) activeCard.hidden = true;
      renderCollectionQueue(data);
      switchTab('queue');
      return;
    }

    // Single video/audio
    if (collectionCard) collectionCard.hidden = true;
    if (queueCountBadge) queueCountBadge.textContent = '1';
    showSinglePreview(data);
    renderFormatsTable(data);

    const preset = getSelectedPreset();
    if (preset === 'pick') {
      switchTab('formats');
      return;
    }

    switchTab('queue');
    if (data.itemTicket) {
      const picked = chooseFormatFromPreset(data.choices ?? [], preset);
      await startDownloadFlow({
        itemTicket: data.itemTicket,
        url: data.url || urls[0],
        title: data.title || 'Video',
        platform: data.platform || detectPlatform(urls[0]),
        formatId: picked.formatId,
        kind: picked.kind,
        formatLabel: picked.formatLabel,
      });
    }
  } catch {
    showAlert('Mất kết nối tạm thời khi phân tích đường dẫn.', true);
  } finally {
    busy = false;
    if (btnMain) btnMain.disabled = false;
    if (btnBatchSubmit) btnBatchSubmit.disabled = false;
    if (btnMainLabel) btnMainLabel.textContent = oldLabel;
    updateMainButtonLabel();
  }
}

// --- Event Wiring ---

inputUrl?.addEventListener('input', updatePlatformBadgeFromInput);
inputUrl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    void handleSingleOrPlaylistSubmit();
  }
});

inputBatch?.addEventListener('input', updatePlatformBadgeFromInput);

document.querySelectorAll<HTMLInputElement>('input[name="dl-preset"]').forEach((radio) => {
  radio.addEventListener('change', updateMainButtonLabel);
});

btnPaste?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showAlert('Bộ nhớ tạm (Clipboard) đang trống.', true);
      return;
    }
    const extracted = extractUrlsFromInput(text);
    if (extracted.length > 1) {
      if (!isBatchMode) btnBatchToggle?.click();
      if (inputBatch) inputBatch.value = extracted.join('\n');
      updatePlatformBadgeFromInput();
    } else if (inputUrl) {
      inputUrl.value = extracted[0] ?? text.trim();
      updatePlatformBadgeFromInput();
    }
  } catch {
    showAlert('Trình duyệt yêu cầu quyền truy cập Clipboard. Bạn hãy nhấn Ctrl+V (hoặc ⌘V) trực tiếp vào ô nhập nhé.', true);
    inputUrl?.focus();
  }
});

btnClear?.addEventListener('click', () => {
  if (inputUrl) inputUrl.value = '';
  showAlert('');
  updatePlatformBadgeFromInput();
  inputUrl?.focus();
});

btnBatchToggle?.addEventListener('click', () => {
  isBatchMode = !isBatchMode;
  btnBatchToggle.setAttribute('aria-pressed', String(isBatchMode));
  if (batchToggleLabel) {
    batchToggleLabel.textContent = isBatchMode ? 'Chế độ 1 link' : 'Tải nhiều link';
  }
  if (singleWrap) singleWrap.hidden = isBatchMode;
  if (batchWrap) batchWrap.hidden = !isBatchMode;
  updatePlatformBadgeFromInput();
});

btnBatchClear?.addEventListener('click', () => {
  if (inputBatch) inputBatch.value = '';
  updatePlatformBadgeFromInput();
});

btnMain?.addEventListener('click', () => {
  void handleSingleOrPlaylistSubmit();
});

btnBatchSubmit?.addEventListener('click', () => {
  const urls = extractUrlsFromInput(inputBatch?.value ?? '');
  if (urls.length === 0) {
    showAlert('Chưa tìm thấy đường dẫn hợp lệ nào trong danh sách.', true);
    return;
  }
  void handleSingleOrPlaylistSubmit(urls);
});

tabBtnQueue?.addEventListener('click', () => switchTab('queue'));
tabBtnViral?.addEventListener('click', () => switchTab('viral'));
tabBtnFormats?.addEventListener('click', () => switchTab('formats'));
tabBtnHistory?.addEventListener('click', () => switchTab('history'));
btnSwitchFormats?.addEventListener('click', () => switchTab('formats'));

// WAI-ARIA Tabs roving tabindex keyboard navigation (ArrowRight, ArrowLeft, Home, End)
tablistEl?.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
    return;
  }
  e.preventDefault();
  const currentIdx = Math.max(
    0,
    TAB_ORDER.findIndex((key) => {
      const btn =
        key === 'queue'
          ? tabBtnQueue
          : key === 'viral'
            ? tabBtnViral
            : key === 'formats'
              ? tabBtnFormats
              : tabBtnHistory;
      return btn?.getAttribute('aria-selected') === 'true';
    }),
  );

  let nextIdx = currentIdx;
  if (e.key === 'ArrowRight') {
    nextIdx = (currentIdx + 1) % TAB_ORDER.length;
  } else if (e.key === 'ArrowLeft') {
    nextIdx = (currentIdx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
  } else if (e.key === 'Home') {
    nextIdx = 0;
  } else if (e.key === 'End') {
    nextIdx = TAB_ORDER.length - 1;
  }

  switchTab(TAB_ORDER[nextIdx], true);
});

btnSelectAll?.addEventListener('click', () => {
  collectionEntries.forEach((e) => (e.selected = true));
  collectionList?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => (c.checked = true));
  if (collectionSubtitle) {
    collectionSubtitle.textContent = `Đã chọn ${collectionEntries.length}/${collectionEntries.length} mục`;
  }
});

btnSelectNone?.addEventListener('click', () => {
  collectionEntries.forEach((e) => (e.selected = false));
  collectionList?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => (c.checked = false));
  if (collectionSubtitle) {
    collectionSubtitle.textContent = `Đã chọn 0/${collectionEntries.length} mục`;
  }
});

btnDownloadSelected?.addEventListener('click', async () => {
  if (busy) return;
  const selected = collectionEntries.filter((e) => e.selected && e.itemTicket);
  if (selected.length === 0) {
    showAlert('Vui lòng tích chọn ít nhất 1 mục để tải.', true);
    return;
  }
  busy = true;
  if (btnDownloadSelected) btnDownloadSelected.disabled = true;

  const preset = getSelectedPreset();
  const kind = preset === 'audio' ? 'audio' : 'video';
  const formatId = preset === 'audio' ? 'audio' : preset === '720' ? '720' : 'best';
  const formatLabel = preset === 'audio' ? 'MP3' : preset === '720' ? '720P' : 'BEST';

  try {
    for (const entry of selected) {
      const setStatus = (entry as DlEntry & { _setStatus?: (t: string) => void })._setStatus;
      await startDownloadFlow({
        itemTicket: entry.itemTicket!,
        url: entry.url,
        title: entry.title,
        platform: entry.platform || detectPlatform(entry.url),
        formatId,
        kind,
        formatLabel,
        onRowStatus: setStatus,
      });
      await new Promise((r) => setTimeout(r, 800));
    }
  } finally {
    busy = false;
    if (btnDownloadSelected) btnDownloadSelected.disabled = false;
  }
});

btnClearHistory?.addEventListener('click', () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
  renderHistory();
});

// --- Initial Status Check & Render ---

async function checkDaemonStatus() {
  try {
    const res = await fetch('/api/dl/status');
    const data = (await res.json().catch(() => ({}))) as {
      online?: boolean;
      tier?: 'public' | 'admin';
      limits?: { maxHeight: number; maxFilesizeMB: number; maxBatchItems: number };
    };
    daemonOnlineState = Boolean(data.online);
    if (statusDot && statusText) {
      if (daemonOnlineState) {
        statusDot.style.backgroundColor = '#15803d';
        statusText.textContent = 'Lõi yt-dlp & ffmpeg sẵn sàng';
      } else {
        statusDot.style.backgroundColor = '#b45309';
        statusText.textContent = 'Máy chủ tải đang tạm nghỉ';
      }
    }
    updateSpeedPill();
    if (tierBadge && data.limits) {
      if (data.tier === 'admin') {
        tierBadge.textContent = `Chế độ Admin · Mở khóa 4K (${data.limits.maxHeight}p) · Mổ xẻ ≤ 30 phút`;
      } else {
        tierBadge.textContent = `Chế độ Công khai · Tối đa ${data.limits.maxHeight}p · Mổ xẻ ≤ 5 phút`;
      }
    }
  } catch {
    daemonOnlineState = false;
    updateSpeedPill();
    if (statusText) statusText.textContent = 'Không thể kiểm tra trạng thái máy chủ';
  }
}

const viralLab = initViralLab({
  getUrlInput: () => inputUrl?.value.trim() ?? '',
  setUrlInput: (val: string) => {
    if (inputUrl) {
      inputUrl.value = val;
      updatePlatformBadgeFromInput();
    }
  },
  getVisitorId,
  showAlert,
  switchToViralTab: () => switchTab('viral'),
});

// Handle deep-links such as /tai-video?url=...&tab=viral from /xray/[id] share cards
try {
  const params = new URLSearchParams(window.location.search);
  const queryUrl = params.get('url');
  const queryTab = params.get('tab');
  if (queryUrl && inputUrl) {
    const safe = validateSafeMediaUrl(queryUrl);
    if (safe.ok) {
      inputUrl.value = safe.url;
      updatePlatformBadgeFromInput();
    }
  }
  if (queryTab === 'viral') {
    switchTab('viral');
  }
} catch {
  // ignore URL parsing error
}

renderHistory();
void checkDaemonStatus();
