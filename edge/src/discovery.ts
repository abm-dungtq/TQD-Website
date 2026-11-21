// Machine-readable discovery surfaces: RSS, JSON Feed, catalog, search index, sitemap and the A2A agent card.
// Shaped after the Astro implementations they replace, but fed by the EzyPlatform public API instead of D1.
import {
  cleanSite,
  latestUpdated,
  OPEN_FALLBACK_DATE,
  toIsoUtc,
  type Link,
  type ReaderArticle,
  type ReaderData,
  type ReaderItem,
} from './site';

export const READ_ONLY_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

export function escapeXml(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const introParagraphs = (intro: string): string[] =>
  intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const siteMeta = (data: ReaderData, origin: string) => {
  const person = data.site.person;
  const role = person.role?.trim() || 'Ứng dụng AI vào vận hành doanh nghiệp';
  const firstIntro = introParagraphs(person.intro ?? '')[0] ?? '';
  return {
    personName: person.name?.trim() || 'Trịnh Quang Dũng',
    personHandle: person.handle?.trim() || 'DũngTQ',
    description: firstIntro ? `${role}. ${firstIntro}` : role,
    email: person.email?.trim() || 'dungtq.ceo@gmail.com',
    authorLabel: `${person.name?.trim() || 'Trịnh Quang Dũng'} (${person.handle?.trim() || 'DũngTQ'})`,
    authorUrl: `${origin}/ho-so`,
  };
};

const publishedArticles = (articles: ReaderArticle[]): ReaderArticle[] =>
  articles
    .filter((a) => a.slug)
    .slice()
    .sort((a, b) => new Date(toIsoUtc(b.publishedAt ?? b.updatedAt)).getTime() - new Date(toIsoUtc(a.publishedAt ?? a.updatedAt)).getTime());

export function buildRssXml(data: ReaderData, siteOrigin: string): string {
  const origin = cleanSite(siteOrigin);
  const meta = siteMeta(data, origin);
  const items = publishedArticles(data.articles);
  const latestMs = items.reduce(
    (max, a) => Math.max(max, new Date(toIsoUtc(a.updatedAt ?? a.publishedAt)).getTime()),
    0,
  );
  const lastBuildDate = (latestMs > 0 ? new Date(latestMs) : new Date()).toUTCString();

  const itemXml = items.map((a) => {
    const slugEncoded = encodeURIComponent(a.slug);
    const articleUrl = `${origin}/bai-viet/${slugEncoded}`;
    const mdUrl = `${origin}/bai-viet/${slugEncoded}.md`;
    const summaryText = (a.summary || a.title).trim();
    const categories = (a.tags ?? [])
      .filter((tag) => tag.trim().length > 0)
      .map((tag) => `      <category>${escapeXml(tag.trim())}</category>`)
      .join('\n');
    return [
      '    <item>',
      `      <title>${escapeXml(a.title)}</title>`,
      `      <link>${escapeXml(articleUrl)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>`,
      `      <pubDate>${escapeXml(new Date(toIsoUtc(a.publishedAt ?? a.updatedAt)).toUTCString())}</pubDate>`,
      `      <author>${escapeXml(`${meta.email} (${meta.personName})`)}</author>`,
      `      <description>${escapeXml(`${summaryText} - Đọc bản Markdown cho AI Agent: ${mdUrl}`)}</description>${categories ? `\n${categories}` : ''}`,
      '    </item>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(`${meta.authorLabel} - Bài viết & Tri thức AI`)}</title>`,
    `    <link>${escapeXml(`${origin}/`)}</link>`,
    `    <description>${escapeXml(meta.description)}</description>`,
    '    <language>vi</language>',
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
    ...itemXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

export function buildJsonFeed(data: ReaderData, siteOrigin: string): Record<string, unknown> {
  const origin = cleanSite(siteOrigin);
  const meta = siteMeta(data, origin);
  const author = { name: meta.authorLabel, url: meta.authorUrl };
  const items = publishedArticles(data.articles).map((a) => {
    const slugEncoded = encodeURIComponent(a.slug);
    const articleUrl = `${origin}/bai-viet/${slugEncoded}`;
    return {
      id: articleUrl,
      url: articleUrl,
      title: a.title,
      summary: (a.summary || a.title).trim(),
      date_published: toIsoUtc(a.publishedAt ?? a.updatedAt),
      date_modified: toIsoUtc(a.updatedAt ?? a.publishedAt),
      tags: (a.tags ?? []).filter((tag) => tag.trim().length > 0),
      authors: [author],
      _tqd: {
        kind: 'article',
        slug: a.slug,
        markdown_url: `${origin}/bai-viet/${slugEncoded}.md`,
      },
    };
  });

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${meta.authorLabel} - tqd.me`,
    home_page_url: `${origin}/`,
    feed_url: `${origin}/feed.json`,
    description: meta.description,
    language: 'vi-VN',
    authors: [author],
    items,
  };
}

export interface CatalogLink {
  label: string;
  url: string;
}

interface CatalogItem {
  id: string;
  type: 'article' | 'product' | 'video' | 'tool';
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  htmlUrl: string;
  markdownUrl: string | null;
  imageUrl?: string;
  links?: CatalogLink[];
}

const toCatalogLinks = (links: Link[]): CatalogLink[] =>
  links.map((link) => ({ label: link.label, url: link.href })).filter((link) => /^https?:\/\//.test(link.url));

export function buildCatalog(data: ReaderData, siteOrigin: string, generatedAt = new Date().toISOString()): Record<string, unknown> {
  const origin = cleanSite(siteOrigin);
  const person = data.site.person;
  const articleItems: CatalogItem[] = data.articles.map((a) => ({
    id: `article:${a.slug}`,
    type: 'article',
    slug: a.slug,
    title: a.title,
    summary: (a.summary || a.title).trim(),
    tags: a.tags,
    publishedAt: a.publishedAt ? toIsoUtc(a.publishedAt) : null,
    updatedAt: a.updatedAt ? toIsoUtc(a.updatedAt) : null,
    htmlUrl: `${origin}/bai-viet/${encodeURIComponent(a.slug)}`,
    markdownUrl: `${origin}/bai-viet/${encodeURIComponent(a.slug)}.md`,
  }));

  const productItems: CatalogItem[] = data.products.map((p) => {
    const links = toCatalogLinks(p.links);
    return {
      id: `product:${p.id}`,
      type: 'product',
      slug: `product-${p.id}`,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      publishedAt: null,
      updatedAt: null,
      htmlUrl: `${origin}/san-pham`,
      markdownUrl: `${origin}/san-pham.md`,
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      ...(links.length > 0 ? { links } : {}),
    };
  });

  const shopTool: CatalogItem = {
    id: 'tool:shop',
    type: 'tool',
    slug: 'shop',
    title: 'Cửa hàng Gói Google AI Ultra & Veo',
    summary:
      'Bộ cấu hình 4 bước và bảng giá 23 gói Google AI Ultra (5x, 20x) & Veo Flow chính chủ: Slot Family và Full Family.',
    tags: ['Shop', 'Google AI Ultra', 'Veo', 'Google Flow', 'Antigravity'],
    publishedAt: null,
    updatedAt: null,
    htmlUrl: `${origin}/shop`,
    markdownUrl: `${origin}/shop.md`,
    imageUrl: `${origin}/og.png`,
    links: [
      { label: 'Mở cửa hàng', url: `${origin}/shop` },
      { label: 'Bảng giá Markdown', url: `${origin}/shop.md` },
    ],
  };

  const taiVideoTool: CatalogItem = {
    id: 'tool:tai-video',
    type: 'tool',
    slug: 'tai-video',
    title: 'Tải Video Đa Nền Tảng & Xưởng Mổ Xẻ Kịch Bản Viral AI',
    summary:
      'Công cụ tải video MP4 chuẩn H.264, tách nhạc MP3 320kbps, bóc băng lời thoại AI (Transcript/SRT) và viết lại kịch bản đa kênh chuẩn chống văn mẫu Viết Pro.',
    tags: ['Tải Video', 'Viral Video Lab', 'Viết Pro', 'MP4', 'MP3'],
    publishedAt: null,
    updatedAt: null,
    htmlUrl: `${origin}/tai-video`,
    markdownUrl: `${origin}/tai-video.md`,
    imageUrl: `${origin}/og/tai-video.png`,
    links: [
      { label: 'Mở công cụ', url: `${origin}/tai-video` },
      { label: 'Đặc tả Markdown', url: `${origin}/tai-video.md` },
    ],
  };

  const videoItems: CatalogItem[] = data.videos.map((v) => {
    const links = toCatalogLinks(v.links);
    return {
      id: `video:${v.id}`,
      type: 'video',
      slug: `video-${v.id}`,
      title: v.title,
      summary: v.summary,
      tags: v.tags,
      publishedAt: null,
      updatedAt: null,
      htmlUrl: `${origin}/video-ai`,
      markdownUrl: `${origin}/video-ai.md`,
      ...(v.imageUrl ? { imageUrl: v.imageUrl } : {}),
      ...(links.length > 0 ? { links } : {}),
    };
  });

  return {
    schemaVersion: '1.0',
    generatedAt: toIsoUtc(generatedAt),
    siteOrigin: origin,
    owner: {
      name: person.name,
      handle: person.handle,
      role: person.role?.trim() || '',
      profileUrl: `${origin}/ho-so`,
      zaloUrl: person.zalo || 'https://zalo.me/trinhquangdung',
      email: person.email || 'dungtq.ceo@gmail.com',
    },
    sections: data.site.sections.map((section) => ({
      id: section.id,
      title: section.title,
      short: section.short,
      htmlUrl: `${origin}/${section.id}`,
      markdownUrl: `${origin}/${section.id}.md`,
    })),
    endpoints: {
      llmsTxt: `${origin}/llms.txt`,
      wellKnownLlmsTxt: `${origin}/.well-known/llms.txt`,
      llmsFullTxt: `${origin}/llms-full.txt`,
      agentCard: `${origin}/.well-known/agent.json`,
      catalogJson: `${origin}/catalog.json`,
      rssXml: `${origin}/rss.xml`,
      feedJson: `${origin}/feed.json`,
      sitemapXml: `${origin}/sitemap.xml`,
      searchJson: `${origin}/search.json`,
    },
    items: [...articleItems, ...productItems, shopTool, taiVideoTool, ...videoItems],
  };
}

export interface SearchEntry {
  title: string;
  url: string;
  kind: 'section' | 'article' | 'product' | 'video';
  hint: string;
  id?: string;
}

export function buildSearchEntries(data: ReaderData): SearchEntry[] {
  const sectionTitle = (id: string): string => data.site.sections.find((section) => section.id === id)?.title ?? '';
  return [
    {
      title: 'Đặt lịch tư vấn & đào tạo AI Doanh nghiệp (Zalo trực tiếp)',
      url: 'https://zalo.me/trinhquangdung',
      kind: 'section',
      hint: 'zalo.me/trinhquangdung',
    },
    ...data.site.sections.map((section) => ({
      title: section.title,
      url: `/${section.id}`,
      kind: 'section' as const,
      hint: section.short,
      id: section.id,
    })),
    {
      title: 'Cửa hàng Google AI Ultra & Veo Flow (Shop)',
      url: '/shop',
      kind: 'product',
      hint: '23 gói Google AI Ultra 5x/20x & Veo: Slot Family và Full Family chính chủ',
    },
    {
      title: 'Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI (Viết Pro)',
      url: '/tai-video',
      kind: 'product',
      hint: 'Tải MP4 H.264, MP3 320kbps, Bóc băng & Nhân bản kịch bản',
    },
    {
      title: 'Chính sách Quyền riêng tư & Dữ liệu',
      url: '/quyen-rieng-tu',
      kind: 'section',
      hint: 'Minh bạch dữ liệu, không quảng cáo, tự xóa tạm',
    },
    {
      title: 'Kho tri thức đầy đủ cho AI Agent (llms-full.txt)',
      url: '/llms-full.txt',
      kind: 'product',
      hint: 'Toàn văn hồ sơ, sản phẩm & bài viết dạng Markdown',
    },
    ...data.articles.map((article) => ({
      title: article.title,
      url: `/bai-viet/${article.slug}`,
      kind: 'article' as const,
      hint: article.summary,
    })),
    ...data.products.map((item) => ({
      title: item.title,
      url: '/san-pham',
      kind: 'product' as const,
      hint: sectionTitle('san-pham'),
      id: 'san-pham',
    })),
    ...data.videos.map((item) => ({
      title: item.title,
      url: '/video-ai',
      kind: 'video' as const,
      hint: sectionTitle('video-ai'),
      id: 'video-ai',
    })),
  ];
}

export function buildSitemap(data: ReaderData, siteOrigin: string): string {
  const origin = cleanSite(siteOrigin);
  const lastmod = latestUpdated(data) ?? OPEN_FALLBACK_DATE;
  const urls = [
    { loc: `${origin}/`, lastmod },
    { loc: `${origin}/shop`, lastmod },
    { loc: `${origin}/tai-video`, lastmod },
    { loc: `${origin}/quyen-rieng-tu`, lastmod },
    ...data.site.sections.map((section) => ({ loc: `${origin}/${section.id}`, lastmod })),
    ...data.articles.map((article) => ({
      loc: `${origin}/bai-viet/${encodeURIComponent(article.slug)}`,
      lastmod: toIsoUtc(article.updatedAt ?? article.publishedAt ?? lastmod),
    })),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${escapeXml(u.lastmod)}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

export function buildRobots(siteOrigin: string): string {
  const origin = cleanSite(siteOrigin);
  const agents = [
    '*',
    'OAI-SearchBot',
    'ChatGPT-User',
    'GPTBot',
    'Claude-SearchBot',
    'Claude-User',
    'ClaudeBot',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
  ];
  return [
    '# tqd.me — Mở cửa cho mọi công cụ tìm kiếm & AI Search / User-Fetch / Research Crawlers',
    '# Khu vực quản trị (/admin) và API nội bộ (/api/) luôn được bảo vệ riêng.',
    '',
    ...agents.flatMap((agent) => [`User-agent: ${agent}`, 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', '']),
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

const PLATFORM_LABELS = [
  'YouTube',
  'TikTok',
  'Douyin',
  'Facebook',
  'Instagram',
  'X / Twitter',
  'Threads',
  'Reddit',
  'Twitch',
  'Vimeo',
  'Bilibili',
  'SoundCloud',
  'Dailymotion',
  'Pinterest',
];

const VIRAL_FORMAT_KEYS = ['tiktok-script', 'fb-story', 'threads-chain', 'youtube-outline', 'linkedin-expert'];

export function buildAgentCard(data: ReaderData, siteOrigin: string): Record<string, unknown> {
  const origin = cleanSite(siteOrigin);
  const person = data.site.person;
  const fullName = `${person.name} (${person.handle})`;
  const zaloUrl = person.zalo || 'https://zalo.me/trinhquangdung';
  const email = person.email || 'dungtq.ceo@gmail.com';
  const productSummaryList = data.products.map((product) => product.title).join(', ');

  return {
    schemaVersion: '1.0',
    name: `${person.handle} Web Agent`,
    description: `Tác nhân đại diện cho ${fullName} tại ABM trên tqd.me, hỗ trợ tra cứu hồ sơ, sản phẩm AI, bài viết và đặc tả công cụ tải video / phân tích kịch bản Viral AI.`,
    url: origin,
    documentationUrl: `${origin}/llms.txt`,
    version: '1.0.0',
    provider: {
      name: fullName,
      organization: 'Công ty Cổ phần Công nghệ và Đào tạo ABM',
      organizationUrl: 'https://lp.abmedu.vn',
      url: `${origin}/ho-so`,
      contact: {
        zaloUrl,
        email,
        contactPage: `${origin}/lien-he`,
      },
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/markdown', 'application/json', 'text/event-stream'],
    endpoints: {
      llmsTxt: `${origin}/llms.txt`,
      wellKnownLlmsTxt: `${origin}/.well-known/llms.txt`,
      llmsFullTxt: `${origin}/llms-full.txt`,
      agentCard: `${origin}/.well-known/agent.json`,
      catalogJson: `${origin}/catalog.json`,
      rssXml: `${origin}/rss.xml`,
      feedJson: `${origin}/feed.json`,
      sitemapXml: `${origin}/sitemap.xml`,
      shop: `${origin}/shop`,
      shopMarkdown: `${origin}/shop.md`,
      taiVideo: `${origin}/tai-video`,
      taiVideoMarkdown: `${origin}/tai-video.md`,
    },
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
      markdownNegotiation: {
        supported: true,
        acceptHeader: 'text/markdown',
        varyHeader: 'Accept',
        twinSuffix: '.md',
      },
      webmcp_browser_tools: {
        supported: true,
        entryApi: 'document.modelContext',
        webOnlyExecution: true,
        tools: [
          'search_tqd_knowledge',
          'read_markdown_page',
          'list_ai_products',
          'get_contact_info',
          'open_desktop_section',
          'prefill_tai_video',
        ],
        note: 'Chỉ đăng ký trong trình duyệt qua document.modelContext; công cụ /tai-video chỉ điền sẵn đầu vào và không tự gửi tác vụ tải.',
      },
      sameOriginPublicApis: {
        protected: true,
        schemes: ['same-origin-browser', 'rate-limit'],
        routes: ['/api/chat', '/api/dl/resolve', '/api/dl/prepare', '/api/viral/transcribe', '/api/viral/generate', '/api/viral/share'],
        note: 'Các tuyến /api/* yêu cầu Origin trùng origin trang kèm Sec-Fetch-Site same-origin và bị giới hạn tần suất theo phiên, IP, hạn mức ngày; bot ngoài trình duyệt đọc qua /catalog.json, /*.md hoặc chuyển tiếp Zalo.',
      },
    },
    authentication: {
      schemes: ['same-origin-browser'],
      publicReadRequiresAuth: false,
      note: 'Toàn bộ bề mặt đọc công khai (/llms.txt, /catalog.json, /rss.xml, /feed.json, /*.md) không cần xác thực; API tương tác chỉ mở cho phiên trình duyệt same-origin.',
    },
    knowledgeScope: {
      topics: [
        `Hồ sơ và kinh nghiệm triển khai AI cho doanh nghiệp của ${fullName} tại ABM`,
        productSummaryList
          ? `Sản phẩm và phần mềm AI từ D1: ${productSummaryList} cùng công cụ /tai-video`
          : 'Hệ sản phẩm AI, Skill và công cụ /tai-video trên tqd.me',
        'Bài viết thực hành AI Agent, tối ưu vận hành doanh nghiệp và chống văn mẫu Viết Pro',
        'Cửa hàng gói Google AI Ultra (5x, 20x) & Veo Flow chính chủ (/shop)',
        'Công cụ Tải Video đa nền tảng và Xưởng Mổ Xẻ Kịch Bản Viral AI (/tai-video)',
      ],
      products: data.products.map((product) => ({
        id: product.id,
        title: product.title,
        summary: product.summary,
        tags: product.tags,
        url: `${origin}/san-pham`,
      })),
      sections: data.site.sections.map((section) => ({
        id: section.id,
        title: section.title,
        url: `${origin}/${section.id}`,
        markdownUrl: `${origin}/${section.id}.md`,
      })),
      publishedArticleCount: data.articles.length,
    },
    rateLimits: {
      chat: {
        visitorPerHour: 20,
        ipPerHour: 60,
        dailySiteCap: 300,
        maxMessageChars: 1000,
      },
      videoDownloader: {
        resolveVisitorPerHour: 30,
        resolveIpPerHour: 60,
        prepareVisitorPerHour: 15,
        prepareIpPerHour: 30,
        dailySiteCap: 150,
        publicTier: {
          maxHeight: 1080,
          maxFilesizeMB: 200,
          maxBatchItems: 25,
          allowCookies: false,
        },
      },
      viralVideoLab: {
        transcribeVisitorPerHour: 8,
        transcribeIpPerHour: 16,
        generateVisitorPerHour: 20,
        generateIpPerHour: 40,
        shareVisitorPerHour: 15,
        shareIpPerHour: 30,
        dailySiteCap: 150,
        publicMaxDurationSec: 300,
      },
    },
    policies: {
      privacyUrl: `${origin}/quyen-rieng-tu`,
      privacyMarkdownUrl: `${origin}/quyen-rieng-tu.md`,
      robotsTxtUrl: `${origin}/robots.txt`,
      xrayShares: {
        curatedPrefix: 'c-',
        curatedRobots: 'index, follow',
        guestRobots: 'noindex, nofollow',
        guestExternalLinksStripped: true,
      },
      mediaProcessing: 'Tệp tải và âm thanh bóc băng tạm chỉ xử lý ngắn hạn rồi tự động xóa, không lưu lại lâu dài.',
      noFacebookPostText: true,
      noThirdPartyAdsOrTracking: true,
    },
    escalation: {
      humanHandoffChannel: 'Zalo B2B',
      zaloUrl,
      email,
      contactPage: `${origin}/lien-he`,
      whenToEscalate: [
        'Khi nhu cầu đào tạo hoặc triển khai AI Agent cho doanh nghiệp vượt phạm vi thông tin công khai',
        'Khi dịch vụ trò chuyện AI tạm ngoại tuyến hoặc trả về HTTP 503',
        'Khi chạm giới hạn sử dụng công khai theo giờ hoặc theo ngày (HTTP 429)',
      ],
    },
    skills: [
      {
        id: 'tqd-knowledge-lookup',
        name: 'Tra cứu tri thức và tài nguyên tqd.me',
        description: `Đọc thông tin sản phẩm AI, bài viết và hồ sơ ${fullName} qua /catalog.json, /llms.txt và các bản .md twin.`,
        tags: ['knowledge', 'markdown', 'catalog'],
        endpoints: [`${origin}/catalog.json`, `${origin}/llms.txt`, `${origin}/llms-full.txt`, `${origin}/feed.json`],
      },
      {
        id: 'tai-video-and-viral-lab',
        name: 'Đặc tả công cụ Tải Video và Viral Video Lab',
        description: `Hỗ trợ tải video trên ${PLATFORM_LABELS.length} nền tảng, bóc băng lời thoại và viết lại kịch bản theo ${VIRAL_FORMAT_KEYS.length} định dạng chuẩn Viết Pro.`,
        tags: ['video-downloader', 'transcript', 'viral-script', 'viet-pro'],
        toolUrl: `${origin}/tai-video`,
        markdownSpecUrl: `${origin}/tai-video.md`,
        supportedPlatforms: PLATFORM_LABELS,
        formats: VIRAL_FORMAT_KEYS,
        actions: ['xray', 'rewrite', 'polish'],
        webOnlyExecution: true,
      },
    ],
  };
}

/** Product/video counts used by the health endpoint and the report; keeps the card's claims auditable. */
export const countByType = (data: ReaderData): { products: number; videos: number; articles: number; gallery: number } => ({
  products: data.products.length,
  videos: data.videos.length,
  articles: data.articles.length,
  gallery: data.gallery.length,
});

export type { ReaderItem };
