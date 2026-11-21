// Site identity and the Markdown readers' builders.
// The profile (person, links, topics, sections) is site metadata, not admin-editable content: it lives here as a
// constant so /llms.txt and the .md twins keep the same shape after the move to EzyPlatform. Articles, products,
// videos and the gallery are read from the origin's public API at request time (see posts.ts).
import rawSite from './site-data.json';
import shopRows from './shop-data.json';

const DEFAULT_SITE = 'https://tqd.me';
export const MAX_LLMS_FULL_CHARS = 120_000;
export const MAX_LLMS_FULL_ARTICLES = 12;

export type SectionId = 'ho-so' | 'san-pham' | 'thu-vien' | 'video-ai' | 'bai-viet' | 'lien-he';

export interface Link {
  label: string;
  href: string;
}

export interface Person {
  name: string;
  handle: string;
  initials?: string;
  role: string;
  intro: string;
  focus?: string[];
  email?: string;
  zalo?: string;
}

export interface Section {
  id: SectionId;
  title: string;
  short: string;
}

export interface GalleryEntry {
  caption: string;
  /** Absolute path (/media/...) or full URL to the asset. */
  href: string;
}

export interface Topics {
  howTo: string[];
  marketWatch: string[];
}

export interface Site {
  person: Person;
  links: Link[];
  topics: Topics;
  sections: Section[];
}

export interface ReaderItem {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  /** dd/mm/yyyy, matching the old /{section}.md output. */
  date?: string;
  links: Link[];
  tiktokId?: string;
  imageUrl?: string;
}

export interface ReaderArticle {
  id: number;
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  tags: string[];
  publishedAt?: string;
  updatedAt?: string;
}

export interface ReaderData {
  site: Site;
  products: ReaderItem[];
  videos: ReaderItem[];
  gallery: GalleryEntry[];
  articles: ReaderArticle[];
}

interface SiteJson {
  person: Person;
  links: Link[];
  topics: Topics;
  sections: Section[];
  gallery?: Array<{ key: string; caption: string }>;
}

export interface ShopProductRow {
  index: number;
  slug: string;
  name: string;
  price: number;
  plan: string;
  upgradeType: string;
  users: number;
  duration: string;
  credit: string;
  refillRule: string;
}

interface ShopJson {
  products: ShopProductRow[];
  requirements: Array<{ step: number; title: string; detail: string; checkUrl: string }>;
  warrantySummary: string;
}

const siteJson = rawSite as SiteJson;
const shop = shopRows as ShopJson;

export const SITE: Site = {
  person: { ...siteJson.person, zalo: siteJson.person.zalo?.trim() || 'https://zalo.me/trinhquangdung' },
  links: siteJson.links,
  topics: siteJson.topics,
  sections: siteJson.sections,
};

/**
 * Media that still lives in the R2 bucket served by the tooling Worker (/media/*). Used only when the origin has no
 * published `tqd_gallery` posts yet, so /thu-vien.md never renders empty during the migration.
 */
export const FALLBACK_GALLERY: GalleryEntry[] = (siteJson.gallery ?? []).map((g) => ({
  caption: g.caption,
  href: `/media/${g.key}`,
}));

export const cleanSite = (site = DEFAULT_SITE): string => site.replace(/\/+$/, '') || DEFAULT_SITE;

export const OPEN_FALLBACK_DATE = '2026-10-12T00:00:00.000Z';

/** Normalize SQLite `YYYY-MM-DD HH:MM:SS`, date-only, epoch millis or ISO strings into full ISO 8601 UTC. */
export function toIsoUtc(value?: string | number | null): string {
  if (value === undefined || value === null) return OPEN_FALLBACK_DATE;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return OPEN_FALLBACK_DATE;
    // EzyPlatform mixes epoch seconds and milliseconds in its JSON payloads; normalise both.
    const ms = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? OPEN_FALLBACK_DATE : parsed.toISOString();
  }
  const raw = value.trim();
  if (!raw) return OPEN_FALLBACK_DATE;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T00:00:00Z`
    : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? OPEN_FALLBACK_DATE : parsed.toISOString();
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

export interface MarkdownFrontmatter {
  source: string;
  title: string;
  author?: string;
  updated?: string;
  summary?: string;
  tags?: string[];
}

/** Serialize Markdown YAML frontmatter with JSON string escaping (identical to the Astro version). */
export function renderFrontmatter(meta: MarkdownFrontmatter): string {
  const lines = ['---', `source: ${JSON.stringify(meta.source)}`, `title: ${JSON.stringify(meta.title)}`];
  if (meta.author) lines.push(`author: ${JSON.stringify(meta.author)}`);
  if (meta.updated) lines.push(`updated: ${JSON.stringify(toIsoUtc(meta.updated))}`);
  if (meta.summary) lines.push(`summary: ${JSON.stringify(meta.summary)}`);
  if (meta.tags && meta.tags.length > 0) {
    lines.push(`tags: [${meta.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`);
  }
  lines.push('---');
  return lines.join('\n');
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '');
}

const list = (items: string[]): string => items.map((i) => `- ${i}`).join('\n');

const absoluteLink = (href: string, base: string): string => (href.startsWith('/') ? `${base}${href}` : href);

const isVideoHref = (href: string): boolean => /\.(mp4|webm)(?:[?#]|$)/i.test(href);

const itemMarkdown = (item: ReaderItem, base: string): string => {
  const lines = [`### ${item.title}`, ''];
  if (item.date) lines.push(`_${item.date}_`, '');
  if (item.imageUrl) lines.push(`![${item.title}](${item.imageUrl})`, '');
  if (item.summary) lines.push(item.summary, '');
  if (item.tags.length > 0) lines.push(`Nhãn: ${item.tags.join(', ')}`);
  if (item.tiktokId) lines.push('', `Video: https://www.tiktok.com/player/v1/${item.tiktokId}`);
  if (item.links.length > 0) {
    lines.push('', item.links.map((l) => `[${l.label}](${absoluteLink(l.href, base)})`).join(' · '));
  }
  return lines.join('\n');
};

function resolveProductUrl(item: ReaderItem, base: string): string {
  const first = item.links[0]?.href;
  if (!first) return `${base}/san-pham`;
  return absoluteLink(first, base);
}

function sectionBody(id: SectionId, data: ReaderData, base: string): string {
  const person = data.site.person;
  const links = data.site.links ?? [];
  const topics = data.site.topics ?? { howTo: [], marketWatch: [] };
  switch (id) {
    case 'ho-so': {
      const featuredProducts = [
        `- [Cửa hàng Gói Google AI Ultra & Veo](${base}/shop): Bảng giá & bộ cấu hình 23 gói Google AI Ultra (5x, 20x) và Veo Flow chính chủ (${base}/shop.md).`,
        `- [Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI](${base}/tai-video): Công cụ web tải MP4 H.264, tách MP3 320kbps, bóc băng lời thoại AI (SRT) và viết lại kịch bản chuẩn Viết Pro.`,
        ...data.products.slice(0, 7).map((p) => `- [${p.title}](${resolveProductUrl(p, base)}): ${p.summary}`),
      ];
      return [
        `**${person.name}** (${person.handle}) — ${person.role}`,
        '',
        person.intro,
        ...(data.products.length > 0
          ? [
              '',
              '### Sản phẩm & mã nguồn mở tiêu biểu',
              '',
              ...featuredProducts,
              '',
              `Xem thêm: [Toàn bộ danh mục sản phẩm](${base}/san-pham.md) · [Kho mã nguồn GitHub @abm-dungtq](https://github.com/abm-dungtq)`,
            ]
          : []),
        '',
        'Trọng tâm:',
        '',
        list(person.focus ?? []),
      ].join('\n');
    }
    case 'san-pham': {
      const items = data.products.map((p) => itemMarkdown(p, base));
      const prices = shop.products.map((p) => p.price);
      const minShopPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxShopPrice = prices.length > 0 ? Math.max(...prices) : 0;
      items.push(
        [
          '### Cửa hàng Gói Google AI Ultra & Veo',
          '',
          `Bộ cấu hình và bảng giá minh bạch 23 gói Google AI Ultra (5x, 20x) & Veo Flow chính chủ (${formatVnd(minShopPrice)} - ${formatVnd(maxShopPrice)}): Slot Family và Full Family.`,
          '',
          'Nhãn: Google AI Ultra, Veo, Google Flow, Antigravity, Shop',
          '',
          `[Chọn gói ngay](${base}/shop) · [Bảng giá Markdown](${base}/shop.md)`,
        ].join('\n'),
        [
          '### Tải Video & Mổ Xẻ Kịch Bản Viral AI',
          '',
          'Công cụ web tải video đa nền tảng chuẩn H.264, tách MP3 320kbps, bóc băng lời thoại AI (SRT) và viết lại kịch bản chuẩn chống văn mẫu **Viết Pro**.',
          '',
          'Nhãn: Công cụ web, Viral AI, Viết Pro',
          '',
          `[Mở công cụ](${base}/tai-video) · [Bản Markdown](${base}/tai-video.md)`,
        ].join('\n'),
      );
      return items.join('\n\n');
    }
    case 'thu-vien':
      return list(
        (data.gallery ?? []).map(
          (g) => `${isVideoHref(g.href) ? 'Video' : 'Ảnh'}: [${g.caption}](${absoluteLink(g.href, base)})`,
        ),
      );
    case 'video-ai':
      return data.videos.map((v) => itemMarkdown(v, base)).join('\n\n');
    case 'bai-viet':
      return data.articles.length
        ? list(data.articles.map((a) => `[${a.title}](${base}/bai-viet/${a.slug}.md)${a.summary ? `: ${a.summary}` : ''}`))
        : ['Chưa có bài viết.', '', '### Chủ đề thường viết', '', list([...topics.howTo, ...topics.marketWatch])].join('\n');
    case 'lien-he':
      return list(links.map((l) => `${l.label}: [${l.href.replace(/^mailto:/, '')}](${l.href})`));
  }
}

export function latestUpdated(data: ReaderData): string | undefined {
  const times = [
    ...data.articles.map((a) => toIsoUtc(a.updatedAt ?? a.publishedAt)),
    ...data.products.map((p) => toIsoUtc(p.date)),
    ...data.videos.map((v) => toIsoUtc(v.date)),
  ].filter((iso) => iso !== OPEN_FALLBACK_DATE);
  if (times.length === 0) return undefined;
  times.sort();
  return times[times.length - 1];
}

export function sectionMarkdown(id: SectionId, data: ReaderData, site = DEFAULT_SITE, lastmod?: string): string | null {
  const base = cleanSite(site);
  const section = data.site.sections.find((s) => s.id === id);
  if (!section) return null;
  const title = `${section.title} · ${data.site.person.handle}`;
  const frontmatter = renderFrontmatter({
    source: `${base}/${id}`,
    title,
    author: `${data.site.person.name} (${data.site.person.handle})`,
    updated: lastmod,
    summary: section.short || undefined,
  });
  const lines = [frontmatter, '', `# ${title}`];
  if (section.short) lines.push('', section.short);
  lines.push('', sectionBody(id, data, base), '');
  return lines.join('\n');
}

export function profileMarkdown(data: ReaderData, site = DEFAULT_SITE, lastmod?: string): string {
  const base = cleanSite(site);
  const { person, sections } = data.site;
  const parts = sections.map((s) => `## ${s.title}\n\n${sectionBody(s.id, data, base)}\n`);
  const title = `${person.name} (${person.handle})`;
  const frontmatter = renderFrontmatter({
    source: `${base}/`,
    title,
    author: title,
    updated: lastmod,
    summary: person.role,
  });
  return [
    frontmatter,
    '',
    `# ${title}`,
    '',
    `> ${person.role}`,
    '',
    `Website: ${base} · Đặt lịch tư vấn AI Doanh nghiệp: https://zalo.me/trinhquangdung`,
    '',
    ...parts,
  ].join('\n');
}

export function articleMarkdown(article: ReaderArticle, data: ReaderData, origin = DEFAULT_SITE): string {
  const base = cleanSite(origin);
  const frontmatter = renderFrontmatter({
    source: `${base}/bai-viet/${article.slug}`,
    title: article.title,
    author: `${data.site.person.name} (${data.site.person.handle})`,
    updated: article.updatedAt,
    summary: article.summary || undefined,
    tags: article.tags,
  });
  const lines = [frontmatter, '', `# ${article.title}`, ''];
  if (article.publishedAt) lines.push(`Đăng ngày: ${toIsoUtc(article.publishedAt)}`, '');
  if (article.summary) lines.push(`_${article.summary}_`, '');
  lines.push(article.bodyMd.trim(), '');
  return lines.join('\n');
}

export function taiVideoMarkdown(site = DEFAULT_SITE, lastmod?: string): string {
  const base = cleanSite(site);
  const title = 'Tải Video Đa Nền Tảng & Xưởng Mổ Xẻ Kịch Bản Viral AI (Viết Pro)';
  const frontmatter = renderFrontmatter({
    source: `${base}/tai-video`,
    title,
    author: 'Trịnh Quang Dũng (DũngTQ)',
    updated: lastmod,
    summary:
      'Công cụ tải video MP4 chuẩn H.264, tách nhạc MP3 320kbps, bóc băng lời thoại AI (SRT) và viết lại kịch bản chuẩn chống văn mẫu Viết Pro.',
    tags: ['Tải video', 'Viral AI', 'Viết Pro', 'SRT'],
  });
  return [
    frontmatter,
    '',
    `# ${title}`,
    '',
    '## Tính năng chính',
    '',
    '- **Tải 1-Click (`TẢI NGAY`)**: Chọn nhanh 3 chế độ `Cao nhất (1080p/4K)`, `HD 720p`, hoặc `Nhạc MP3 320kbps` (ghép luồng H.264 + AAC `faststart` tương thích iPhone, Mac, Windows, Zalo, CapCut).',
    '- **Mổ Xẻ Viral & Nhân Bản Kịch Bản (`MỔ XẺ & VIẾT KỊCH BẢN`)**:',
    '  - Bóc băng lời thoại (Transcript có mốc thời gian & xuất file `.srt`) từ YouTube, TikTok, Douyin, Facebook Reels, Instagram Reels.',
    '  - Giải phẫu X-Quang Hook 3 giây đầu, nhịp giữ chân (Retention Beats) và đòn bẩy tâm lý.',
    '  - **Đổi Ngành Giữ Khung & Việt Hóa Trend Ngoại**: Viết lại kịch bản mới sang 5 định dạng (Bảng kịch bản 3 cột TikTok/Reels, Bài kể chuyện Facebook, Chuỗi Threads 5 bài, Dàn ý YouTube dài, Bài chuyên gia LinkedIn) bằng `deepseek-v4.1-flash` theo bộ quy chuẩn chống văn mẫu AI **Viết Pro**.',
    '  - Kiểm định tự động 21 nhóm bệnh văn mẫu AI ngay trên trình duyệt kèm nút **Khử văn mẫu 1-Click** và tạo link báo cáo chia sẻ `/xray/[id]`.',
    '- **Hỗ trợ hơn 14 nền tảng**: YouTube, Shorts, TikTok, Douyin, Facebook Reels, Instagram Reels, X/Twitter, Threads, SoundCloud, YouTube Music, Bilibili, Vimeo, Reddit.',
    '- **Quyền riêng tư**: File tải và âm thanh bóc băng tạm trong `/tmp/tqd-dl` tự động xóa ngay lập tức sau khi xử lý.',
    '',
  ].join('\n');
}

export function shopMarkdown(site = DEFAULT_SITE, lastmod?: string): string {
  const base = cleanSite(site);
  const title = 'Cửa hàng Gói Google AI Ultra & Veo · DũngTQ';
  const frontmatter = renderFrontmatter({
    source: `${base}/shop`,
    title,
    author: 'Trịnh Quang Dũng (DũngTQ)',
    updated: lastmod,
    summary:
      'Bảng giá 23 gói Google AI Ultra (5x, 20x) & Veo Flow chính chủ: Slot Family và Full Family tại tqd.me.',
    tags: ['Google AI Ultra', 'Veo', 'Google Flow', 'Antigravity', 'Shop'],
  });
  return [
    frontmatter,
    '',
    `# ${title}`,
    '',
    'Trang cấu hình và tra cứu toàn bộ 23 gói Google AI Ultra (5x và 20x) dùng cho Gemini, Google Antigravity, NotebookLM, Google Flow (Veo) và Google Drive 20–30 TB.',
    '',
    '## Quy tắc phân biệt 4 nhóm Credit',
    '',
    '- **0 Credit:** Chỉ dùng bộ công cụ AI (Gemini, Google Antigravity, NotebookLM, AI Studio) và kho Drive dùng chung (20 TB hoặc 30 TB). Không có credit tạo video Veo trên Flow.',
    '- **Random (0-10.000 / 0-25.000 / 0-750.000):** Lượng credit khả dụng biến động ngẫu nhiên trong khoảng công bố và tính theo lượng đã dùng; không hỗ trợ refill hay cấp bù nếu dùng hết.',
    '- **Cố định (10k đến 750k):** Cam kết dùng đủ đúng số credit ghi trên tên gói; các gói cần nạp thêm được hỗ trợ refill từ 9:00 - 23:00 (GMT+7).',
    '- **Unlimited:** Không giới hạn tổng lượng credit trong thời hạn gói nhờ refill 25.000 credit/lần (9:00 - 23:00 GMT+7).',
    '',
    '## Điều kiện tài khoản trước khi nâng cấp',
    '',
    ...shop.requirements.map((r) => `${r.step}. **${r.title}:** ${r.detail} (${r.checkUrl})`),
    '',
    '## Bảng giá 23 gói sản phẩm',
    '',
    '| # | Tên gói | Giá bán | Dòng & Hình thức | Thời hạn | Credit Flow | Refill |',
    '|---:|---|---:|---|---|---|---|',
    ...shop.products.map(
      (p) =>
        `| ${p.index} | [${p.name}](${base}/shop?sku=${p.slug}) | ${formatVnd(p.price)} | ${p.plan} · ${p.upgradeType} (${p.users} user) | ${p.duration} | ${p.credit} | ${p.refillRule} |`,
    ),
    '',
    '## Liên hệ đặt gói & bảo hành',
    '',
    '- **Đặt gói trực tiếp qua Zalo:** https://zalo.me/trinhquangdung',
    `- **Trang cấu hình tương tác:** ${base}/shop`,
    `- **Chính sách bảo hành:** ${shop.warrantySummary}`,
    '',
  ].join('\n');
}

export function privacyMarkdown(site = DEFAULT_SITE, email = 'dungtq.ceo@gmail.com', lastmod?: string): string {
  const base = cleanSite(site);
  const title = 'Chính sách Quyền riêng tư · DũngTQ';
  const frontmatter = renderFrontmatter({
    source: `${base}/quyen-rieng-tu`,
    title,
    author: 'Trịnh Quang Dũng (DũngTQ)',
    updated: lastmod,
    summary: `Nguyên tắc dữ liệu tại ${base}: thống kê nội bộ không cookie, Google Analytics và Microsoft Clarity chỉ chạy khi người đọc đồng ý, không pixel quảng cáo. Liên hệ ${email}.`,
  });
  return [
    frontmatter,
    '',
    `# ${title}`,
    '',
    'Trang web này đo lường theo hai lớp. Thống kê nội bộ không cookie luôn chạy để đếm lượt đọc. Google Analytics và Microsoft Clarity chỉ chạy sau khi người đọc bấm Đồng ý. Trang không hiển thị quảng cáo, không gắn pixel quảng cáo và không bán dữ liệu.',
    '',
    '## 1. Đo lường lượt xem ẩn danh',
    '',
    'Hệ thống sử dụng Cloudflare Web Analytics và bộ đếm nội bộ ẩn danh để thống kê trang nào được đọc, thời gian đọc và nguồn giới thiệu tổng quát. Địa chỉ IP không được lưu trữ thô; định danh ngày được băm một chiều (SHA-256) kèm muối ngẫu nhiên và tự động mất hiệu lực sau 24 giờ.',
    '',
    '## 2. Google Analytics và Microsoft Clarity chỉ chạy khi bạn đồng ý',
    '',
    'Lần đầu ghé trang, người đọc thấy một khung hỏi ý kiến. Trước khi họ bấm Đồng ý, trình duyệt không tải mã nào của Google hay Microsoft và không có cookie đo lường nào được đặt. Trình duyệt bật Global Privacy Control được tính là đã từ chối.',
    '',
    '- Khi có sự đồng ý, Google Analytics 4 đặt cookie `_ga` và `_ga_*` (lưu tối đa 2 năm), ghi lại trang được xem, mức cuộn trang, nguồn dẫn tới trang, loại thiết bị, khu vực ước lượng theo thành phố và lượt bấm vào liên kết Zalo, Messenger, email, điện thoại, chỉ đường, mạng xã hội. Số điện thoại và địa chỉ email trong các liên kết này không được gửi đi.',
    '- Khi có sự đồng ý, Microsoft Clarity đặt cookie `_clck` (tối đa 1 năm) và `_clsk` (1 ngày), ghi lại chỗ bấm, mức cuộn và di chuyển chuột để dựng bản đồ nhiệt và bản ghi phiên. Mọi chữ gõ vào ô nhập liệu, nội dung khung trò chuyện với trợ lý AI và kết quả của công cụ tải video đều bị che. Clarity cũng có thể đặt cookie `MUID`, `CLID`, `ANONCHK`, `SM` trên tên miền của Microsoft (`clarity.ms`, `bing.com`), lưu tối đa 1 năm. Bản ghi phiên được giữ 30 ngày (bản ghi được đánh dấu lưu lại giữ tới 13 tháng), dữ liệu tổng hợp và bản đồ nhiệt tối đa 13 tháng.',
    '- Google LLC và Microsoft Corporation xử lý phần dữ liệu này trên máy chủ của họ, có thể đặt ngoài Việt Nam. Đây là hai bên thứ ba duy nhất nhận dữ liệu đo lường từ trang.',
    '- Google Signals và tính năng cá nhân hóa quảng cáo đều tắt; Clarity chỉ được phép phân tích. Dữ liệu sự kiện trên Google Analytics được giữ tối đa 14 tháng.',
    '- Người đọc đổi lựa chọn bất kỳ lúc nào qua liên kết Tùy chọn đo lường ở cuối trang. Khi rút lại sự đồng ý, trang ngừng gửi dữ liệu cho Google và Microsoft, đồng thời xóa các cookie `_ga`, `_gid`, `_clck`, `_clsk`. Cookie nằm trên tên miền của Microsoft không xóa được từ trang; người đọc xóa chúng trong cài đặt trình duyệt.',
    '',
    '## 3. Trợ lý Trò chuyện AI & Công cụ Tải / Mổ xẻ Video',
    '',
    '- Khi bạn gửi câu hỏi trong khung Trò chuyện AI, nội dung tin nhắn được chuyển tới mô hình ngôn ngữ để trả lời trực tiếp và áp dụng giới hạn tần suất chống lạm dụng.',
    '- Khi bạn sử dụng công cụ Tải Video & Mổ Xẻ Kịch Bản tại `/tai-video`, đường dẫn video chỉ được xử lý tạm thời trong thư mục `/tmp/tqd-dl` để truyền tải về thiết bị của bạn rồi tự động xóa ngay sau khi hoàn tất. Lịch sử tải gần đây chỉ nằm trong `localStorage` trên trình duyệt của chính bạn.',
    '',
    '## 4. Cookie',
    '',
    'Trang công khai không đặt cookie quảng cáo. Cookie đo lường `_ga` của Google Analytics và `_clck`, `_clsk` của Microsoft Clarity chỉ xuất hiện sau khi bạn đồng ý. Cookie phiên bảo mật (`HttpOnly`, `Secure`, `SameSite=Lax`) chỉ được sử dụng duy nhất cho quản trị viên khi đăng nhập khu vực quản trị riêng.',
    '',
    '## 5. Liên hệ',
    '',
    `Mọi thắc mắc liên quan đến dữ liệu và quyền riêng tư, vui lòng gửi thư về [${email}](mailto:${email}) hoặc nhắn Zalo trực tiếp tại [zalo.me/trinhquangdung](https://zalo.me/trinhquangdung).`,
    '',
  ].join('\n');
}

export function llmsText(data: ReaderData, site = DEFAULT_SITE): string {
  const base = cleanSite(site);
  const { person, sections } = data.site;
  const lines = [
    `# ${person.name} (${person.handle})`,
    '',
    `> ${person.role}`,
    '',
    person.intro,
    '',
    '- Tư vấn & Đào tạo AI Doanh nghiệp (Zalo trực tiếp): https://zalo.me/trinhquangdung',
    `- Email công việc: mailto:${person.email || 'dungtq.ceo@gmail.com'}`,
    '',
    '## Sản phẩm & Công cụ AI nổi bật',
    '',
    ...data.products.map((p) => `- [${p.title}](${resolveProductUrl(p, base)}): ${p.summary}`),
    `- [Cửa hàng Gói Google AI Ultra & Veo](${base}/shop): Bảng giá và bộ cấu hình 23 gói Google AI Ultra (5x, 20x) & Veo Flow chính chủ (bản Markdown tại ${base}/shop.md)`,
    `- [Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI](${base}/tai-video): Công cụ web tải MP4 H.264, tách MP3 320kbps, bóc băng lời thoại (SRT) và viết lại kịch bản chuẩn chống văn mẫu Viết Pro (bản Markdown tại ${base}/tai-video.md)`,
    '',
    '## Pages',
    '',
    ...sections.map((s) => `- [${s.title}](${base}/${s.id}.md): ${s.short}`),
    `- [Cửa hàng Gói Google AI Ultra & Veo](${base}/shop.md): Danh mục đầy đủ 23 gói Google AI Ultra (5x, 20x) & Veo Flow chính chủ`,
    `- [Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI](${base}/tai-video.md): Tài liệu Markdown đầy đủ về tính năng tải video, X-Quang Viral và kiểm định Viết Pro`,
    `- [Chính sách Quyền riêng tư](${base}/quyen-rieng-tu.md): Thống kê nội bộ không cookie, Google Analytics và Microsoft Clarity chỉ chạy khi người đọc đồng ý, không pixel quảng cáo và tự động xóa file tạm`,
  ];
  if (data.articles.length > 0) {
    lines.push(
      '',
      '## Bài viết',
      '',
      ...data.articles.map((a) => `- [${a.title}](${base}/bai-viet/${a.slug}.md)${a.summary ? `: ${a.summary}` : ''}`),
    );
  }
  lines.push(
    '',
    '## Danh mục máy đọc (Machine Discovery)',
    '',
    `- [Agent Card (A2A)](${base}/.well-known/agent.json): Mô tả năng lực, công cụ WebMCP và endpoint máy đọc của ${base}`,
    `- [Catalog JSON](${base}/catalog.json): Danh mục có cấu trúc gồm sản phẩm, video AI, bài viết và mẫu X-Quang Viral tiêu biểu`,
    `- [RSS 2.0 Feed](${base}/rss.xml): Nguồn cấp RSS bài viết mới nhất`,
    `- [JSON Feed 1.1](${base}/feed.json): Nguồn cấp bài viết định dạng JSON Feed`,
    `- [XML Sitemap](${base}/sitemap.xml): Toàn bộ URL được lập chỉ mục kèm dấu thời gian ISO 8601 UTC`,
    `- [Kho tri thức đầy đủ (Full Context)](${base}/llms-full.txt): Gom trọn hồ sơ, sản phẩm, công cụ và toàn văn tối đa 12 bài viết mới nhất`,
    '',
    '## Optional',
    '',
    `- [Toàn bộ hồ sơ tóm tắt](${base}/index.md): Bản tổng hợp các mục chính trên trang chủ`,
    `- [Bản sao chuẩn RFC 8615](${base}/.well-known/llms.txt): Điểm truy cập thay thế tại thư mục well-known`,
    '',
  );
  return lines.join('\n');
}

const formatArticleSummaryLine = (a: ReaderArticle, base: string): string =>
  `- [${a.title}](${base}/bai-viet/${a.slug}.md)${a.summary ? `: ${a.summary}` : ''}`;

const formatArticleFullBlock = (a: ReaderArticle, base: string, author: string): string => {
  const published = a.publishedAt ? toIsoUtc(a.publishedAt) : '';
  const updated = a.updatedAt ? toIsoUtc(a.updatedAt) : '';
  const lines = [
    `### ${a.title}`,
    '',
    `> URL: ${base}/bai-viet/${a.slug} · Bản Markdown: ${base}/bai-viet/${a.slug}.md · Tác giả: ${author}${published ? ` · Đăng ngày: ${published}` : ''}${updated ? ` · Cập nhật: ${updated}` : ''}`,
    '',
  ];
  if (a.summary) lines.push(`_${a.summary}_`, '');
  if (a.tags.length > 0) lines.push(`Chủ đề: ${a.tags.join(', ')}`, '');
  if (a.bodyMd) lines.push(a.bodyMd.trim(), '');
  lines.push('---', '');
  return lines.join('\n');
};

export function llmsFullText(data: ReaderData, site = DEFAULT_SITE, lastmod?: string): string {
  const base = cleanSite(site);
  const { person, sections } = data.site;
  const author = `${person.name} (${person.handle})`;
  const sourceArticles = data.articles;
  const fullCandidates = sourceArticles.slice(0, MAX_LLMS_FULL_ARTICLES);
  const candidateSlugs = new Set(fullCandidates.map((a) => a.slug));
  const olderArticles = [
    ...sourceArticles.slice(MAX_LLMS_FULL_ARTICLES),
    ...data.articles.filter((a) => !candidateSlugs.has(a.slug)),
  ];

  const tocLines = [
    '## Mục lục',
    '',
    ...sections.map((s) => `- [${s.title}](${base}/${s.id}.md)${s.short ? `: ${s.short}` : ''}`),
    `- [Cửa hàng Gói Google AI Ultra & Veo](${base}/shop.md)`,
    `- [Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI](${base}/tai-video.md)`,
    `- [Chính sách Quyền riêng tư](${base}/quyen-rieng-tu.md)`,
  ];
  if (fullCandidates.length > 0 || olderArticles.length > 0) {
    tocLines.push(
      '',
      '### Danh sách bài viết',
      '',
      ...[...fullCandidates, ...olderArticles].map((a) => formatArticleSummaryLine(a, base)),
    );
  }

  const profileBody = stripFrontmatter(profileMarkdown(data, base, lastmod)).replace(/^# .*\n+/, '');
  const shopBody = stripFrontmatter(shopMarkdown(base, lastmod));
  const taiVideoBody = stripFrontmatter(taiVideoMarkdown(base, lastmod));
  const privacyBody = stripFrontmatter(privacyMarkdown(base, person.email, lastmod));

  const preamble = [
    `# Kho Tri Thức Đầy Đủ — ${author}`,
    '',
    `> Nguồn gốc: ${base}/llms-full.txt${lastmod ? ` · Cập nhật: ${toIsoUtc(lastmod)}` : ''} · Tác giả: ${author}`,
    '',
    ...tocLines,
    '',
    '---',
    '',
    profileBody.trimEnd(),
    '',
    '---',
    '',
    shopBody.trimEnd(),
    '',
    '---',
    '',
    taiVideoBody.trimEnd(),
    '',
    '---',
    '',
    privacyBody.trimEnd(),
    '',
  ].join('\n');

  const chunks: string[] = [preamble];
  let currentLength = preamble.length;
  const overflowArticles: ReaderArticle[] = [];
  const overflowHeader = '---\n\n## Bài viết khác (Tóm tắt & liên kết Markdown)\n\n';

  if (fullCandidates.length > 0) {
    const articlesHeader = '---\n\n## Toàn văn Bài viết chuyên sâu\n\n';
    if (currentLength + articlesHeader.length <= MAX_LLMS_FULL_CHARS) {
      let bodyChunk = articlesHeader;
      currentLength += articlesHeader.length;
      const includedBlocks: string[] = [];

      for (let i = 0; i < fullCandidates.length; i += 1) {
        const a = fullCandidates[i];
        const block = formatArticleFullBlock(a, base, author);
        const remainingTail = [...overflowArticles, ...fullCandidates.slice(i + 1), ...olderArticles];
        const remainingOverflowReserve =
          remainingTail.length > 0
            ? overflowHeader.length +
              remainingTail.reduce((sum, item) => sum + formatArticleSummaryLine(item, base).length + 1, 1)
            : 0;

        if (currentLength + block.length + remainingOverflowReserve <= MAX_LLMS_FULL_CHARS) {
          includedBlocks.push(block);
          currentLength += block.length;
        } else {
          overflowArticles.push(...fullCandidates.slice(i));
          break;
        }
      }

      if (includedBlocks.length > 0) {
        bodyChunk += includedBlocks.join('');
        chunks.push(bodyChunk);
      } else {
        currentLength -= articlesHeader.length;
      }
    } else {
      overflowArticles.push(...fullCandidates);
    }
  }

  const tailSummaryItems = [...overflowArticles, ...olderArticles];
  if (tailSummaryItems.length > 0) {
    const summaryLines = ['---', '', '## Bài viết khác (Tóm tắt & liên kết Markdown)', ''];
    let running = currentLength + `${summaryLines.join('\n')}\n`.length;
    for (const item of tailSummaryItems) {
      const line = formatArticleSummaryLine(item, base);
      if (running + line.length + 1 > MAX_LLMS_FULL_CHARS) break;
      summaryLines.push(line);
      running += line.length + 1;
    }
    if (summaryLines.length > 4) {
      chunks.push(`${summaryLines.join('\n')}\n`);
    }
  }

  const out = chunks.join('');
  return out.length <= MAX_LLMS_FULL_CHARS ? out : out.slice(0, MAX_LLMS_FULL_CHARS);
}

export const markdownResponse = (body: string, type = 'text/markdown', extra: Record<string, string> = {}): Response =>
  new Response(body, {
    headers: {
      'Content-Type': `${type}; charset=utf-8`,
      'X-Robots-Tag': 'noindex',
      ...extra,
    },
  });
