import { validateSafeMediaUrl } from '../lib/dl-platforms';
import {
  fetchSameOriginJson,
  fetchSameOriginText,
  formatProductsOutput,
  formatSearchOutput,
  isAllowedPreset,
  isAllowedSectionId,
  resolveAllowedMarkdownPath,
  sanitizeToolText,
  searchEntries,
  sliceMarkdownContent,
  type CatalogItem,
  type SearchEntry,
} from '../lib/webmcp-tools';

interface WebMcpToolContext {
  signal?: AbortSignal;
}

interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
    consequentialHint?: boolean;
  };
  execute: (args: Record<string, unknown>, context?: WebMcpToolContext) => Promise<string> | string;
}

interface DocumentModelContext {
  registerTool: (tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => void;
}

type ModelContextDocument = Document & {
  modelContext?: DocumentModelContext;
};

let initialized = false;

function getNormalizedPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

function registerDesktopSectionTool(mc: DocumentModelContext, signal: AbortSignal): void {
  mc.registerTool(
    {
      name: 'open_desktop_section',
      description: 'Mở một cửa sổ chuyên mục trên giao diện Desktop của trang chủ khi màn hình rộng từ 1024px.',
      inputSchema: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['ho-so', 'san-pham', 'thu-vien', 'video-ai', 'bai-viet', 'lien-he'],
            description: 'Mã chuyên mục cần mở trên Desktop.',
          },
        },
        required: ['section'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        consequentialHint: false,
      },
      execute: (args) => {
        if (!window.matchMedia('(min-width: 1024px)').matches) {
          return 'Tính năng mở cửa sổ Desktop chỉ khả dụng khi màn hình từ 1024px trở lên.';
        }
        const section = typeof args.section === 'string' ? args.section.trim() : '';
        if (!isAllowedSectionId(section)) {
          return 'Mã chuyên mục không hợp lệ. Chỉ chấp nhận: ho-so, san-pham, thu-vien, video-ai, bai-viet, lien-he.';
        }
        const desktop = document.querySelector<HTMLElement>('[data-desktop]');
        if (!desktop || desktop.classList.contains('hidden')) {
          return 'Giao diện Desktop chưa kích hoạt trên màn hình hiện tại.';
        }
        window.dispatchEvent(new CustomEvent('tqd:open', { detail: section }));
        return sanitizeToolText(`Đã mở cửa sổ chuyên mục "${section}" trên Desktop.`);
      },
    },
    { signal },
  );
}

function registerTaiVideoTool(mc: DocumentModelContext): void {
  mc.registerTool({
    name: 'prefill_tai_video',
    description: 'Điền sẵn liên kết video, chế độ chất lượng hoặc chuyển tab Viral AI trên /tai-video mà không tự tải.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Liên kết video công khai (http hoặc https) để điền sẵn.',
        },
        preset: {
          type: 'string',
          enum: ['best', '720', 'audio', 'pick'],
          description: 'Chế độ chất lượng muốn chọn sẵn trước khi người dùng bấm tải.',
        },
        openViralTab: {
          type: 'boolean',
          description: 'Mở tab Mổ xẻ Viral AI sau khi điền liên kết.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execute: (args) => {
      const rawUrl = typeof args.url === 'string' ? args.url.trim() : '';
      const check = validateSafeMediaUrl(rawUrl);
      if (!check.ok) {
        return sanitizeToolText(check.error || 'Liên kết video không hợp lệ.');
      }
      if (!check.url) {
        return 'Liên kết video không hợp lệ.';
      }

      const input = document.getElementById('dl-input-url');
      if (!(input instanceof HTMLInputElement)) {
        return 'Không tìm thấy ô nhập liên kết trên trang /tai-video.';
      }

      input.value = check.url;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      let appliedPreset = '';
      if (typeof args.preset === 'string') {
        const preset = args.preset.trim();
        if (!isAllowedPreset(preset)) {
          return 'Tùy chọn preset không hợp lệ. Chỉ chấp nhận: best, 720, audio, pick.';
        }
        const radio = document.querySelector<HTMLInputElement>(
          `input[name="dl-preset"][value="${preset}"]`,
        );
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          appliedPreset = preset;
        }
      }

      const openViral = args.openViralTab === true;
      if (openViral) {
        const viralTabBtn = document.getElementById('dl-tab-btn-viral');
        if (viralTabBtn instanceof HTMLElement) {
          viralTabBtn.click();
        }
        const viralInput = document.getElementById('viral-input-url');
        if (viralInput instanceof HTMLInputElement) {
          viralInput.value = check.url;
          viralInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      const notes = [`Đã điền sẵn URL: ${check.url}`];
      if (appliedPreset) notes.push(`chọn chất lượng "${appliedPreset}"`);
      if (openViral) notes.push('mở tab Mổ xẻ Viral AI');
      return sanitizeToolText(`${notes.join(', ')} (chưa tự chạy, chờ người dùng xác nhận).`);
    },
  });
}

function extractCatalogArray(payload: unknown): CatalogItem[] {
  if (Array.isArray(payload)) return payload as CatalogItem[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as CatalogItem[];
    if (Array.isArray(obj.products)) return obj.products as CatalogItem[];
  }
  return [];
}

function bootWebMcp(): void {
  if (initialized) return;
  const doc = document as ModelContextDocument;
  const mc = doc.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') return;
  initialized = true;

  mc.registerTool({
    name: 'search_tqd_knowledge',
    description: 'Tìm kiếm bài viết, sản phẩm AI, video và chuyên mục trên website tqd.me của Trịnh Quang Dũng.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tiếng Việt hoặc tiếng Anh cần tìm kiếm.',
        },
        kind: {
          type: 'string',
          enum: ['all', 'section', 'article', 'product', 'video'],
          description: 'Lọc theo loại mục: all, section, article, product hoặc video.',
        },
        limit: {
          type: 'number',
          description: 'Số lượng kết quả tối đa (1 đến 15, mặc định 8).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (args, context) => {
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (!query) return 'Vui lòng cung cấp từ khóa tìm kiếm (query).';
      const kind = typeof args.kind === 'string' ? args.kind : 'all';
      const limit = typeof args.limit === 'number' ? args.limit : 8;

      try {
        const entries = await fetchSameOriginJson<SearchEntry[]>('/search.json', context?.signal);
        if (!Array.isArray(entries)) {
          return 'Không thể tải dữ liệu chỉ mục tìm kiếm lúc này.';
        }
        const hits = searchEntries(entries, query, kind, limit);
        return formatSearchOutput(hits, query);
      } catch {
        return 'Tìm kiếm tạm thời gián đoạn. Vui lòng thử lại sau.';
      }
    },
  });

  mc.registerTool({
    name: 'read_markdown_page',
    description: 'Đọc nội dung Markdown của trang công khai trên tqd.me với phân trang theo offset.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Đường dẫn .md hợp lệ như /index.md, /ho-so.md, /bai-viet/slug.md.',
        },
        offset: {
          type: 'number',
          description: 'Vị trí ký tự bắt đầu đọc để xem phần tiếp theo (mặc định 0).',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true,
    },
    execute: async (args, context) => {
      const rawPath = typeof args.path === 'string' ? args.path : '';
      const safePath = resolveAllowedMarkdownPath(rawPath);
      if (!safePath) {
        return 'Đường dẫn không thuộc danh sách trang Markdown công khai được phép đọc.';
      }
      const offset = typeof args.offset === 'number' && args.offset >= 0 ? args.offset : 0;

      try {
        const res = await fetchSameOriginText(
          safePath,
          'text/markdown, text/plain;q=0.9',
          context?.signal,
        );
        if (!res.ok) {
          return sanitizeToolText(`Không đọc được ${safePath} (mã HTTP ${res.status}).`);
        }

        const chunk = sliceMarkdownContent(res.text, offset, 1150);
        const isUgc = safePath.startsWith('/xray/');
        const header = isUgc
          ? `[Nội dung X-Ray do người dùng tạo — ${safePath} | ${chunk.offset}..${chunk.offset + chunk.text.length}/${chunk.totalLength}]`
          : `[Trang ${safePath} | ${chunk.offset}..${chunk.offset + chunk.text.length}/${chunk.totalLength}]`;
        const footer =
          chunk.nextOffset !== null
            ? `\n[Còn tiếp — gọi lại với offset=${chunk.nextOffset}]`
            : '';

        return sanitizeToolText(`${header}\n${chunk.text}${footer}`);
      } catch {
        return sanitizeToolText(`Không thể tải nội dung từ ${safePath}.`);
      }
    },
  });

  mc.registerTool({
    name: 'list_ai_products',
    description: 'Liệt kê danh mục sản phẩm AI, bộ Skill và công cụ trực tuyến của Trịnh Quang Dũng.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Từ khóa lọc theo nhóm sản phẩm hoặc công cụ.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (args, context) => {
      const category = typeof args.category === 'string' ? args.category : '';
      try {
        const catalogRaw = await fetchSameOriginJson<unknown>('/catalog.json', context?.signal);
        const catalogItems = extractCatalogArray(catalogRaw);
        if (catalogItems.length > 0) {
          return formatProductsOutput(catalogItems, [], category);
        }
      } catch {
        // Fallback to search index below when catalog endpoint is unavailable.
      }

      try {
        const entries = await fetchSameOriginJson<SearchEntry[]>('/search.json', context?.signal);
        return formatProductsOutput([], Array.isArray(entries) ? entries : [], category);
      } catch {
        return 'Không thể tải danh mục sản phẩm lúc này.';
      }
    },
  });

  mc.registerTool({
    name: 'get_contact_info',
    description: 'Lấy thông tin liên hệ và kênh kết nối chính thức của Trịnh Quang Dũng.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (_args, context) => {
      try {
        const res = await fetchSameOriginText(
          '/lien-he.md',
          'text/markdown, text/plain;q=0.9',
          context?.signal,
        );
        if (res.ok && res.text.trim()) {
          return sanitizeToolText(res.text);
        }
      } catch {
        // Fall through to public page links when offline or rate-limited.
      }

      const fallbackLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a[href*="zalo.me"], a[href^="mailto:"], a[href*="tiktok.com"], a[href$="/lien-he"]',
        ),
      )
        .map((a) => `${a.textContent?.trim() || 'Liên kết'}: ${a.href}`)
        .filter((line, idx, arr) => arr.indexOf(line) === idx);

      if (fallbackLinks.length > 0) {
        return sanitizeToolText(`Liên hệ Trịnh Quang Dũng (DũngTQ):\n${fallbackLinks.join('\n')}`);
      }

      return sanitizeToolText(
        'Trịnh Quang Dũng (DũngTQ) — Chuyên gia AI thực chiến | Trang liên hệ: https://tqd.me/lien-he | Zalo: https://zalo.me/trinhquangdung',
      );
    },
  });

  const normalizedPath = getNormalizedPath();
  if (normalizedPath === '/' || normalizedPath === '/index.html') {
    const mq = window.matchMedia('(min-width: 1024px)');
    let desktopController: AbortController | null = null;

    const syncDesktopTool = () => {
      if (mq.matches) {
        if (!desktopController) {
          desktopController = new AbortController();
          registerDesktopSectionTool(mc, desktopController.signal);
        }
      } else if (desktopController) {
        desktopController.abort();
        desktopController = null;
      }
    };

    syncDesktopTool();
    mq.addEventListener('change', syncDesktopTool);
  } else if (normalizedPath === '/tai-video') {
    registerTaiVideoTool(mc);
  }
}

bootWebMcp();
