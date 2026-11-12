// Markdown versions of the site content, for /index.md, /{section}.md, /llms.txt and /llms-full.txt readers.
import { isVideoKey, mediaUrl, type Item, type SectionId, type SiteData } from './content';

const DEFAULT_SITE = 'https://tqd.me';

const itemMarkdown = (item: Item, site = DEFAULT_SITE): string => {
  const lines = [`### ${item.title}`, ''];
  if (item.date) lines.push(`_${item.date}_`, '');
  if (item.coverKey && item.kind === 'product') lines.push(`![${item.title}](${site}${mediaUrl(item.coverKey)})`, '');
  lines.push(item.summary, '', `Nhãn: ${item.tags.join(', ')}`);
  if (item.tiktokId) lines.push('', `Video: https://www.tiktok.com/player/v1/${item.tiktokId}`);
  // Links to the site's own pages are stored relative; markdown readers need them absolute.
  if (item.links?.length) lines.push('', item.links.map((l) => `[${l.label}](${l.href.startsWith('/') ? site + l.href : l.href})`).join(' · '));
  return lines.join('\n');
};

const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

function sectionBody(id: SectionId, data: SiteData, site = DEFAULT_SITE): string {
  const person = data.site.person;
  const links = data.site.links ?? [];
  const topics = data.site.topics ?? { howTo: [], marketWatch: [] };
  switch (id) {
    case 'ho-so':
      return [
        `**${person?.name ?? 'Trịnh Quang Dũng'}** (${person?.handle ?? 'DũngTQ'}) — ${person?.role ?? ''}`,
        '',
        person?.intro ?? '',
        '',
        'Trọng tâm:',
        '',
        list(person?.focus ?? []),
      ].join('\n');
    case 'san-pham':
      return data.products.map((p) => itemMarkdown(p, site)).join('\n\n');
    case 'thu-vien':
      return list((data.site.gallery ?? []).map((g) => `${isVideoKey(g.key) ? 'Video' : 'Ảnh'}: [${g.caption}](${site}${mediaUrl(g.key)})`));
    case 'video-ai':
      return data.videos.map((v) => itemMarkdown(v, site)).join('\n\n');
    case 'bai-viet':
      return data.articles.length
        ? list(data.articles.map((a) => `[${a.title}](${site}/bai-viet/${a.slug}.md)${a.summary ? `: ${a.summary}` : ''}`))
        : ['Chưa có bài viết.', '', '### Chủ đề thường viết', '', list([...topics.howTo, ...topics.marketWatch])].join('\n');
    case 'lien-he':
      return list(links.map((l) => `${l.label}: [${l.href.replace(/^mailto:/, '')}](${l.href})`));
  }
}

export function sectionMarkdown(id: SectionId, data: SiteData, site = DEFAULT_SITE, lastmod?: string): string | null {
  const section = data.site.sections.find((s) => s.id === id);
  if (!section) return null;
  const personName = data.site.person?.name ?? 'Trịnh Quang Dũng';
  const personHandle = data.site.person?.handle ?? 'DũngTQ';
  const metaParts = [`Nguồn: ${site}/${id}`, `Tác giả: ${personName} (${personHandle})`];
  if (lastmod) metaParts.push(`Cập nhật: ${lastmod}`);

  const lines = [
    `# ${section.title} · ${personHandle}`,
    '',
    `> ${metaParts.join(' · ')}`,
  ];
  if (section.short) {
    lines.push('', section.short);
  }
  lines.push('', sectionBody(id, data, site), '');
  return lines.join('\n');
}

export function profileMarkdown(data: SiteData, site = DEFAULT_SITE): string {
  const { person, sections } = data.site;
  const parts = sections.map((s) => `## ${s.title}\n\n${sectionBody(s.id, data, site)}\n`);
  return [
    `# ${person.name} (${person.handle})`,
    '',
    `> ${person.role}`,
    '',
    `Website: ${site} · Đặt lịch tư vấn AI Doanh nghiệp: https://zalo.me/trinhquangdung`,
    '',
    ...parts,
  ].join('\n');
}

export function taiVideoMarkdown(site = DEFAULT_SITE): string {
  return [
    '# Tải Video Đa Nền Tảng & Xưởng Mổ Xẻ Kịch Bản Viral AI (Viết Pro)',
    '',
    `> Nguồn: ${site}/tai-video · Tác giả: Trịnh Quang Dũng (DũngTQ)`,
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

export function privacyMarkdown(site = DEFAULT_SITE, email = 'dungtq.ceo@gmail.com'): string {
  return [
    '# Chính sách Quyền riêng tư · DũngTQ',
    '',
    `> Nguồn: ${site}/quyen-rieng-tu · Chủ sở hữu dữ liệu: Trịnh Quang Dũng (DũngTQ) · Liên hệ: ${email}`,
    '',
    'Trang web này được vận hành với nguyên tắc tôn trọng tuyệt đối quyền riêng tư của người đọc: không quảng cáo, không theo dõi chéo trang (cross-site tracking), và không bán hay chia sẻ dữ liệu cho bên thứ ba.',
    '',
    '## 1. Đo lường lượt xem ẩn danh',
    '',
    'Hệ thống sử dụng Cloudflare Web Analytics và bộ đếm nội bộ ẩn danh để thống kê trang nào được đọc, thời gian đọc và nguồn giới thiệu tổng quát. Địa chỉ IP không được lưu trữ thô; định danh ngày được băm một chiều (SHA-256) kèm muối ngẫu nhiên và tự động mất hiệu lực sau 24 giờ.',
    '',
    '## 2. Trợ lý Trò chuyện AI & Công cụ Tải / Mổ xẻ Video',
    '',
    '- Khi bạn gửi câu hỏi trong khung Trò chuyện AI, nội dung tin nhắn được chuyển tới mô hình ngôn ngữ để trả lời trực tiếp và áp dụng giới hạn tần suất chống lạm dụng.',
    '- Khi bạn sử dụng công cụ Tải Video & Mổ Xẻ Kịch Bản tại `/tai-video`, đường dẫn video chỉ được xử lý tạm thời trong thư mục `/tmp/tqd-dl` để truyền tải về thiết bị của bạn rồi tự động xóa ngay sau khi hoàn tất. Lịch sử tải gần đây chỉ nằm trong `localStorage` trên trình duyệt của chính bạn.',
    '',
    '## 3. Cookie',
    '',
    'Trang công khai hoàn toàn không đặt cookie quảng cáo hay cookie theo dõi. Cookie phiên bảo mật (`HttpOnly`, `Secure`, `SameSite=Lax`) chỉ được sử dụng duy nhất cho quản trị viên khi đăng nhập khu vực `/admin`.',
    '',
    '## 4. Liên hệ',
    '',
    `Mọi thắc mắc liên quan đến dữ liệu và quyền riêng tư, vui lòng gửi thư về [${email}](mailto:${email}) hoặc nhắn Zalo trực tiếp tại [zalo.me/trinhquangdung](https://zalo.me/trinhquangdung).`,
    '',
  ].join('\n');
}

export function llmsText(data: SiteData, site = DEFAULT_SITE): string {
  const { person, sections } = data.site;
  const lines = [
    `# ${person.name} (${person.handle})`,
    '',
    `> ${person.role}`,
    '',
    person.intro,
    '',
    `- Tư vấn & Đào tạo AI Doanh nghiệp (Zalo trực tiếp): https://zalo.me/trinhquangdung`,
    `- Email công việc: mailto:${person.email || 'dungtq.ceo@gmail.com'}`,
    '',
    '## Pages',
    '',
    ...sections.map((s) => `- [${s.title}](${site}/${s.id}.md): ${s.short}`),
    `- [Tải Video & Xưởng Mổ Xẻ Kịch Bản Viral AI](${site}/tai-video.md): Tải video MP4 chuẩn H.264, tách nhạc MP3 320kbps, bóc băng lời thoại AI (Transcript/SRT) và viết lại kịch bản chuẩn chống văn mẫu Viết Pro`,
    `- [Chính sách Quyền riêng tư](${site}/quyen-rieng-tu.md): Nguyên tắc bảo mật dữ liệu, không quảng cáo, không theo dõi chéo trang và tự động xóa file tạm`,
  ];
  if (data.articles.length) {
    lines.push(
      '',
      '## Bài viết',
      '',
      ...data.articles.map((a) => `- [${a.title}](${site}/bai-viet/${a.slug}.md)${a.summary ? `: ${a.summary}` : ''}`),
    );
  }
  lines.push(
    '',
    '## Optional',
    '',
    `- [Toàn bộ hồ sơ tóm tắt](${site}/index.md): Bản tổng hợp các mục chính trên trang chủ`,
    `- [Toàn bộ kho tri thức đầy đủ (Full Context)](${site}/llms-full.txt): Gom trọn hồ sơ, sản phẩm, công cụ và toàn văn mọi bài viết trong 1 tệp Markdown duy nhất cho AI Agent`,
    '',
  );
  return lines.join('\n');
}

export function llmsFullText(data: SiteData, site = DEFAULT_SITE, lastmod?: string): string {
  const { person } = data.site;
  const header = [
    `# Kho Tri Thức Đầy Đủ — ${person.name} (${person.handle})`,
    '',
    `> Nguồn gốc: ${site}/llms-full.txt${lastmod ? ` · Cập nhật: ${lastmod}` : ''} · Tác giả: ${person.name} (${person.handle})`,
    '',
    profileMarkdown(data, site).replace(/^# .*\n+/, ''),
    '---',
    '',
    taiVideoMarkdown(site),
    '---',
    '',
    privacyMarkdown(site, person.email),
  ];

  if (data.articles.length > 0) {
    header.push('---', '', '## Toàn văn Bài viết chuyên sâu', '');
    for (const a of data.articles) {
      const published = a.publishedAt ? a.publishedAt.slice(0, 10) : '';
      const updated = a.updatedAt ? a.updatedAt.slice(0, 10) : '';
      header.push(
        `### ${a.title}`,
        '',
        `> URL: ${site}/bai-viet/${a.slug} · Tác giả: ${person.name} (${person.handle})${published ? ` · Đăng ngày: ${published}` : ''}${updated ? ` · Cập nhật: ${updated}` : ''}`,
        '',
      );
      if (a.summary) header.push(`_${a.summary}_`, '');
      if (a.tags?.length) header.push(`Chủ đề: ${a.tags.join(', ')}`, '');
      if (a.bodyMd) header.push(a.bodyMd.trim(), '');
      header.push('---', '');
    }
  }

  return header.join('\n');
}

export const markdownResponse = (body: string, type = 'text/markdown') =>
  // Markdown twins and llms.txt are for agents; noindex keeps them from competing with the HTML pages in search.
  new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8`, 'X-Robots-Tag': 'noindex' } });
