// Renders public/og.png and per-route static OG cards in public/og/*.png (1200×630)
// using the Ivory Atelier palette and portrait. Build/script-time only — never imported in Worker code.
// Usage: node scripts/make-og.mjs
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildCardSvg({ eyebrow, title, subtitle, detail, footer = 'Trịnh Quang Dũng · DũngTQ' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="18%" cy="22%" r="70%">
      <stop offset="0" stop-color="#b8935a" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#faf7f1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pearl" cx="62%" cy="90%" r="60%">
      <stop offset="0" stop-color="#dce3ea" stop-opacity="0.82"/>
      <stop offset="1" stop-color="#faf7f1" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#faf7f1"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#pearl)"/>
  <rect x="24" y="24" width="1152" height="582" rx="20" fill="none" stroke="#b8935a" stroke-opacity="0.55"/>
  <text x="72" y="116" font-family="Consolas, 'Courier New', monospace" font-size="19" font-weight="600" letter-spacing="2.8" fill="#8a6420">${escapeXml(eyebrow)}</text>
  <text x="72" y="222" font-family="Georgia, 'Times New Roman', serif" font-size="50" font-weight="700" fill="#1b2030">${escapeXml(title)}</text>
  <rect x="72" y="258" width="84" height="2.5" fill="#b8935a"/>
  <text x="72" y="318" font-family="Arial, sans-serif" font-size="27" font-weight="600" fill="#1b2030">${escapeXml(subtitle)}</text>
  <text x="72" y="368" font-family="Arial, sans-serif" font-size="22" fill="#6a6253">${escapeXml(detail)}</text>
  <rect x="72" y="498" width="580" height="1" fill="#b8935a" fill-opacity="0.35"/>
  <text x="72" y="548" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#8a6420">${escapeXml(footer)}</text>
</svg>`;
}

const CARDS = [
  {
    slug: 'ho-so',
    eyebrow: '01 — TQD.ME/HO-SO',
    title: 'Hồ sơ & Năng lực',
    subtitle: 'Đào tạo & Tư vấn ứng dụng AI thực chiến',
    detail: 'BSR · Agribank · ABIC · Hanoitourist',
  },
  {
    slug: 'san-pham',
    eyebrow: '02 — TQD.ME/SAN-PHAM',
    title: 'Sản phẩm & Skill AI',
    subtitle: 'Viết Pro · Opus Video · Tử Vi AI · Tải Video',
    detail: 'Hệ Agent, Skill & Công cụ chạy thực tế mỗi ngày',
  },
  {
    slug: 'thu-vien',
    eyebrow: '03 — TQD.ME/THU-VIEN',
    title: 'Thư viện thực địa',
    subtitle: 'Đào tạo AI nội bộ & Triển khai tại doanh nghiệp',
    detail: 'Hình ảnh lớp học thực chiến cùng đội ngũ vận hành',
  },
  {
    slug: 'video-ai',
    eyebrow: '04 — TQD.ME/VIDEO-AI',
    title: 'Video AI & Kể chuyện',
    subtitle: 'Phim ngắn AI, Motion Video & Kịch bản Viral',
    detail: 'TikTok @abmdungtq · Xưởng sản xuất Opus Video',
  },
  {
    slug: 'bai-viet',
    eyebrow: '05 — TQD.ME/BAI-VIET',
    title: 'Bài viết & Ghi chép',
    subtitle: 'Kinh nghiệm thiết kế Agent, Skill & Vận hành AI',
    detail: 'Ghi chép kỹ thuật thực chiến từ Trịnh Quang Dũng',
  },
  {
    slug: 'lien-he',
    eyebrow: '06 — TQD.ME/LIEN-HE',
    title: 'Liên hệ & Đặt lịch',
    subtitle: 'Tư vấn lộ trình AI & Đào tạo doanh nghiệp',
    detail: 'Zalo: zalo.me/trinhquangdung · dungtq.ceo@gmail.com',
  },
  {
    slug: 'tai-video',
    eyebrow: '07 — TQD.ME/TAI-VIDEO',
    title: 'Tải & Mổ Xẻ Video',
    subtitle: 'Tải MP4 H.264, Bóc băng AI & Nhân bản Kịch bản',
    detail: 'Kiểm định chống văn mẫu AI chuẩn Viết Pro',
  },
  {
    slug: 'quyen-rieng-tu',
    eyebrow: '08 — TQD.ME/QUYEN-RIENG-TU',
    title: 'Quyền riêng tư',
    subtitle: 'Minh bạch dữ liệu, Cookie & Tự động xóa file tạm',
    detail: 'Không quảng cáo · Không bán dữ liệu người dùng',
  },
  {
    slug: 'xray',
    eyebrow: '09 — TQD.ME/XRAY',
    title: 'X-Quang Video Viral',
    subtitle: 'Giải phẫu Hook 3 giây đầu & Kịch bản Viết Pro',
    detail: 'Phân tích cấu trúc giữ chân & Đổi ngành giữ khung',
  },
];

await mkdir('public/og', { recursive: true });

const portrait = await sharp('src/assets/portrait.jpg')
  .resize(420, 560, { fit: 'cover', position: 'top' })
  .toBuffer();
const mask = Buffer.from('<svg width="420" height="560"><rect width="420" height="560" rx="28" fill="#fff"/></svg>');
const rounded = await sharp(portrait)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp('public/og.svg')
  .resize(1200, 630)
  .composite([{ input: rounded, left: 716, top: 35 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');
console.log('OK public/og.png');

for (const card of CARDS) {
  const svgBuffer = Buffer.from(buildCardSvg(card));
  const outPath = `public/og/${card.slug}.png`;
  await sharp(svgBuffer)
    .resize(1200, 630)
    .composite([{ input: rounded, left: 716, top: 35 }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`OK ${outPath}`);
}
