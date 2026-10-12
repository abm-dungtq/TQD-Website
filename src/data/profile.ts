// Single source of site content. Every fact traces to portfolio-ai-tom-tat.md or to
// contact details the owner supplied; no Facebook post text is reproduced here.
import portrait from '../assets/portrait.jpg';

export * from './stats';

export interface Link {
  label: string;
  href: string;
}

export interface Item {
  title: string;
  date?: string;
  summary: string;
  tags: string[];
  links?: Link[];
}

export type SectionId = 'ho-so' | 'san-pham' | 'dao-tao' | 'video-ai' | 'chuyen-mon' | 'so-lieu' | 'lien-he';

export type IconName = 'user' | 'box' | 'presentation' | 'film' | 'book' | 'chart' | 'mail';

export interface Section {
  id: SectionId;
  title: string;
  short: string;
  icon: IconName;
}

export const person = {
  name: 'Trịnh Quang Dũng',
  handle: 'DũngTQ',
  initials: 'TQD',
  role: 'Ứng dụng AI vào vận hành doanh nghiệp · ABM',
  intro:
    'Mình xây agent, skill và quy trình AI chạy được trong công việc thật, rồi đào tạo lại cho doanh nghiệp. Ba năm trước mình chia sẻ về xuất nhập khẩu Trung Quốc – Việt Nam; giờ mình chia sẻ cách đưa AI vào hoạt động doanh nghiệp.',
  focus: [
    'AI agent và điều phối nhiều model',
    'Skill cho Claude Code, Codex, Antigravity',
    'Video làm bằng AI',
    'Đào tạo AI cho doanh nghiệp',
  ],
  email: 'dungtq.ceo@gmail.com',
  zalo: 'https://zalo.me/trinhquangdung',
  portrait,
  portraitAlt: 'Chân dung Trịnh Quang Dũng',
};

export const sections: Section[] = [
  { id: 'ho-so', title: 'Hồ sơ', short: 'Mình là ai, đang làm gì', icon: 'user' },
  { id: 'san-pham', title: 'Sản phẩm', short: 'Skill, agent và công cụ tự xây', icon: 'box' },
  { id: 'dao-tao', title: 'Đào tạo & sự kiện', short: 'Doanh nghiệp và cộng đồng', icon: 'presentation' },
  { id: 'video-ai', title: 'Video AI', short: 'Thử nghiệm video làm bằng AI', icon: 'film' },
  { id: 'chuyen-mon', title: 'Chuyên môn', short: 'Quy trình, mẹo và theo dõi thị trường', icon: 'book' },
  { id: 'so-lieu', title: 'Số liệu', short: '3 tháng hoạt động AI', icon: 'chart' },
  { id: 'lien-he', title: 'Liên hệ', short: 'Kết nối với mình', icon: 'mail' },
];

export const products: Item[] = [
  {
    title: 'Viết Pro',
    date: '10/10/2026',
    summary:
      'Skill giúp trợ lý AI viết tiếng Việt tự nhiên, chạy trong Claude Code, OpenAI Codex và Google Antigravity. Nhận ra các kiểu câu sáo của AI và sửa lại, giữ nguyên tên, số liệu, ngày và link.',
    tags: ['Skill', 'Claude Code', 'Codex', 'Antigravity'],
    links: [{ label: 'GitHub', href: 'https://github.com/abm-dungtq/viet-pro-codex' }],
  },
  {
    title: 'Điều phối nhiều model',
    date: '02/10/2026',
    summary:
      'Opus 5.5 viết skill từng bước rồi làm quản lý, giám sát Gehihi 3.8 Flash làm việc và tự kiểm lỗi đến khi xong, để giảm token.',
    tags: ['Agent', 'Multi-model'],
  },
  {
    title: '3 nhân sự số',
    date: '09/08/2026',
    summary: 'Claude lập kế hoạch, chia việc cho hai agent khác, tự đọc báo cáo và quyết định bàn giao.',
    tags: ['Agent', 'Claude'],
  },
  {
    title: 'Agent tự dựng video',
    date: '25/09–05/10/2026',
    summary: 'Agent tự dựng video; trước đó là quy trình làm video tự động (02/08).',
    tags: ['Agent', 'Video'],
  },
  {
    title: 'Thư viện prompt tạo ảnh',
    date: '24/09/2026',
    summary: 'Thư viện prompt tạo ảnh cho ChatGPT theo nhiều ngành nghề, kèm prompt tạo video.',
    tags: ['Prompt', 'ChatGPT'],
  },
  {
    title: 'App dọn dẹp và tối ưu macOS',
    date: '03/09/2026',
    summary: 'Ứng dụng dọn dẹp, tối ưu macOS làm cùng Gehihi 3.8 Flash, có chia sẻ mã nguồn.',
    tags: ['App', 'macOS'],
  },
];

export const trainings: Item[] = [
  {
    title: 'Đào tạo AI cho EVN Miền Bắc',
    date: '17/09/2026',
    summary: 'Buổi đầu trong một chuỗi đào tạo ứng dụng AI.',
    tags: ['Doanh nghiệp'],
  },
  {
    title: 'Xây dựng doanh nghiệp AI tự hành',
    date: '30/08/2026',
    summary: 'Chương trình miễn phí cho doanh nghiệp.',
    tags: ['Sự kiện'],
    links: [{ label: 'lp.abmedu.vn', href: 'https://lp.abmedu.vn' }],
  },
  {
    title: 'ABM đồng hành cùng doanh nghiệp',
    date: '09/10/2026',
    summary: 'Đồng hành cùng doanh nghiệp ứng dụng AI Agent.',
    tags: ['ABM'],
  },
  {
    title: 'Cộng đồng chọn chủ đề',
    date: '28/09/2026',
    summary: 'Mời cộng đồng chọn chủ đề AI để mình viết bài hoặc chia sẻ skill, prompt, quy trình.',
    tags: ['Cộng đồng'],
  },
];

export const videos: Item[] = [
  { title: 'Short drama với FLUX 3', date: '12/08/2026', summary: 'Thử nghiệm short drama làm bằng FLUX 3.', tags: ['FLUX 3'] },
  {
    title: 'Video 20 giây từ một prompt',
    date: '12/08/2026',
    summary: '73K lượt xem — Reel nhiều lượt xem nhất trong 3 tháng.',
    tags: ['Reel'],
  },
  {
    title: 'Chuỗi video làm 100% bằng AI',
    date: '14/08/2026',
    summary: 'Một chuỗi video làm hoàn toàn bằng AI.',
    tags: ['Series'],
  },
  { title: 'Thử Omni 1.1', date: '28/08/2026', summary: 'Thử nghiệm làm video với Omni 1.1.', tags: ['Omni'] },
  {
    title: 'Video AI kiểm soát ổn định',
    date: '28/09/2026',
    summary: 'Dạng video AI kiểm soát được và cho kết quả ổn định.',
    tags: ['Workflow'],
  },
];

export const expertise = {
  howTo: [
    'Claude CLI lập kế hoạch, chia phase cho Codex',
    'Gehihi làm worker trong OMP',
    'Kết hợp Orca và OMP',
    'Vận hành nhiều CLI bằng Paseo',
    'Cài Hermes-Agent',
    'So sánh chi phí và kết quả Pi, Codex, Claude Code',
    'Chọn model Claude theo việc',
    'Browser automation cho AI',
    'ChatGPT hỗ trợ con học',
  ],
  marketWatch: [
    'Claude Opus 5 và 5.5',
    'GPT 5.6 và GPT-6',
    'Codex',
    'Gemini 3.6 Flash',
    'DeepSeek V4 Flash và V4.1 Flash',
    'Grok 4.6',
    'Antigravity',
    'Omni Flash 1.1',
  ],
};

export const links: Link[] = [
  { label: 'Email', href: 'mailto:dungtq.ceo@gmail.com' },
  { label: 'Zalo', href: 'https://zalo.me/trinhquangdung' },
  { label: 'GitHub', href: 'https://github.com/abm-dungtq' },
  { label: 'Facebook', href: 'https://www.facebook.com/dungtq.ceo87' },
  { label: 'ABM Edu', href: 'https://lp.abmedu.vn' },
];
