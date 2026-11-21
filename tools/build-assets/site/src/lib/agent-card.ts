// A2A Agent Card builder for /.well-known/agent.json.
// Publishes only public read surfaces, public tier limits, and safe same-origin policies.
import { sanitizeCatalogUrl } from './catalog';
import {
  DEFAULT_DAILY_CAP,
  IP_PER_HOUR,
  MAX_MESSAGE_CHARS,
  VISITOR_PER_HOUR,
} from './chat';
import type { SiteData } from './content';
import {
  DEFAULT_DL_DAILY_CAP,
  PUBLIC_IP_PER_HOUR,
  PUBLIC_RESOLVE_IP_PER_HOUR,
  PUBLIC_RESOLVE_VISITOR_PER_HOUR,
  PUBLIC_VISITOR_PER_HOUR,
  TIER_LIMITS,
} from './dl';
import { PLATFORMS } from './dl-platforms';
import { normalizeOrigin } from './feeds';
import {
  DEFAULT_VIRAL_DAILY_CAP,
  PUBLIC_GENERATE_IP_PER_HOUR,
  PUBLIC_GENERATE_VISITOR_PER_HOUR,
  PUBLIC_MAX_VIDEO_SEC,
  PUBLIC_SHARE_IP_PER_HOUR,
  PUBLIC_SHARE_VISITOR_PER_HOUR,
  PUBLIC_TRANSCRIBE_IP_PER_HOUR,
  PUBLIC_TRANSCRIBE_VISITOR_PER_HOUR,
  VIRAL_FORMATS,
} from './viral';

export interface AgentCardProduct {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  url: string;
}

export interface AgentCard {
  schemaVersion: '1.0';
  name: string;
  description: string;
  url: string;
  documentationUrl: string;
  version: string;
  provider: {
    name: string;
    organization: string;
    organizationUrl: string;
    url: string;
    contact: {
      zaloUrl: string;
      email: string;
      contactPage: string;
    };
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  endpoints: {
    llmsTxt: string;
    wellKnownLlmsTxt: string;
    llmsFullTxt: string;
    agentCard: string;
    catalogJson: string;
    rssXml: string;
    feedJson: string;
    sitemapXml: string;
    shop: string;
    shopMarkdown: string;
    taiVideo: string;
    taiVideoMarkdown: string;
  };
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
    markdownNegotiation: {
      supported: boolean;
      acceptHeader: 'text/markdown';
      varyHeader: 'Accept';
      twinSuffix: '.md';
    };
    webmcp_browser_tools: {
      supported: boolean;
      entryApi: 'document.modelContext';
      webOnlyExecution: true;
      tools: string[];
      note: string;
    };
    sameOriginPublicApis: {
      protected: true;
      schemes: string[];
      routes: string[];
      note: string;
    };
  };
  authentication: {
    schemes: string[];
    publicReadRequiresAuth: false;
    note: string;
  };
  knowledgeScope: {
    topics: string[];
    products: AgentCardProduct[];
    sections: Array<{ id: string; title: string; url: string; markdownUrl: string }>;
    publishedArticleCount: number;
  };
  rateLimits: {
    chat: {
      visitorPerHour: number;
      ipPerHour: number;
      dailySiteCap: number;
      maxMessageChars: number;
    };
    videoDownloader: {
      resolveVisitorPerHour: number;
      resolveIpPerHour: number;
      prepareVisitorPerHour: number;
      prepareIpPerHour: number;
      dailySiteCap: number;
      publicTier: {
        maxHeight: number;
        maxFilesizeMB: number;
        maxBatchItems: number;
        allowCookies: boolean;
      };
    };
    viralVideoLab: {
      transcribeVisitorPerHour: number;
      transcribeIpPerHour: number;
      generateVisitorPerHour: number;
      generateIpPerHour: number;
      shareVisitorPerHour: number;
      shareIpPerHour: number;
      dailySiteCap: number;
      publicMaxDurationSec: number;
    };
  };
  policies: {
    privacyUrl: string;
    privacyMarkdownUrl: string;
    robotsTxtUrl: string;
    xrayShares: {
      curatedPrefix: 'c-';
      curatedRobots: 'index, follow';
      guestRobots: 'noindex, nofollow';
      guestExternalLinksStripped: true;
    };
    mediaProcessing: string;
    noFacebookPostText: true;
    noThirdPartyAdsOrTracking: true;
  };
  escalation: {
    humanHandoffChannel: string;
    zaloUrl: string;
    email: string;
    contactPage: string;
    whenToEscalate: string[];
  };
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    endpoints?: string[];
    toolUrl?: string;
    markdownSpecUrl?: string;
    supportedPlatforms?: string[];
    formats?: string[];
    actions?: string[];
    webOnlyExecution?: boolean;
  }>;
}

export function buildAgentCard(data: SiteData, siteOrigin = 'https://tqd.me'): AgentCard {
  const origin = normalizeOrigin(siteOrigin);
  const person = data.site.person;
  const personName = person?.name?.trim() || 'Trịnh Quang Dũng';
  const personHandle = person?.handle?.trim() || 'DũngTQ';
  const fullName = `${personName} (${personHandle})`;
  const zaloUrl =
    sanitizeCatalogUrl(person?.zalo || 'https://zalo.me/trinhquangdung', origin) ?? 'https://zalo.me/trinhquangdung';
  const email = person?.email?.trim() || 'dungtq.ceo@gmail.com';

  const visibleProducts = (data.products ?? []).filter((p) => p.visible !== false);
  const publishedArticles = (data.articles ?? []).filter((a) => a.status !== 'draft');
  const productSummaryList = visibleProducts.map((p) => p.title).join(', ');
  const publicDlTier = TIER_LIMITS.public;

  return {
    schemaVersion: '1.0',
    name: `${personHandle} Web Agent`,
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
      products: visibleProducts.map((p) => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        tags: Array.isArray(p.tags) ? p.tags : [],
        url: `${origin}/san-pham`,
      })),
      sections: (data.site.sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        url: `${origin}/${s.id}`,
        markdownUrl: `${origin}/${s.id}.md`,
      })),
      publishedArticleCount: publishedArticles.length,
    },
    rateLimits: {
      chat: {
        visitorPerHour: VISITOR_PER_HOUR,
        ipPerHour: IP_PER_HOUR,
        dailySiteCap: DEFAULT_DAILY_CAP,
        maxMessageChars: MAX_MESSAGE_CHARS,
      },
      videoDownloader: {
        resolveVisitorPerHour: PUBLIC_RESOLVE_VISITOR_PER_HOUR,
        resolveIpPerHour: PUBLIC_RESOLVE_IP_PER_HOUR,
        prepareVisitorPerHour: PUBLIC_VISITOR_PER_HOUR,
        prepareIpPerHour: PUBLIC_IP_PER_HOUR,
        dailySiteCap: DEFAULT_DL_DAILY_CAP,
        publicTier: {
          maxHeight: publicDlTier.maxHeight,
          maxFilesizeMB: publicDlTier.maxFilesizeMB,
          maxBatchItems: publicDlTier.maxBatchItems,
          allowCookies: publicDlTier.allowCookies,
        },
      },
      viralVideoLab: {
        transcribeVisitorPerHour: PUBLIC_TRANSCRIBE_VISITOR_PER_HOUR,
        transcribeIpPerHour: PUBLIC_TRANSCRIBE_IP_PER_HOUR,
        generateVisitorPerHour: PUBLIC_GENERATE_VISITOR_PER_HOUR,
        generateIpPerHour: PUBLIC_GENERATE_IP_PER_HOUR,
        shareVisitorPerHour: PUBLIC_SHARE_VISITOR_PER_HOUR,
        shareIpPerHour: PUBLIC_SHARE_IP_PER_HOUR,
        dailySiteCap: DEFAULT_VIRAL_DAILY_CAP,
        publicMaxDurationSec: PUBLIC_MAX_VIDEO_SEC,
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
        description: `Hỗ trợ tải video trên ${PLATFORMS.length} nền tảng, bóc băng lời thoại và viết lại kịch bản theo ${VIRAL_FORMATS.length} định dạng chuẩn Viết Pro.`,
        tags: ['video-downloader', 'transcript', 'viral-script', 'viet-pro'],
        toolUrl: `${origin}/tai-video`,
        markdownSpecUrl: `${origin}/tai-video.md`,
        supportedPlatforms: PLATFORMS.map((p) => p.label),
        formats: VIRAL_FORMATS.map((f) => f.key),
        actions: ['xray', 'rewrite', 'polish'],
        webOnlyExecution: true,
      },
    ],
  };
}
