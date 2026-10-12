// Aggregate numbers from portfolio-ai-tom-tat.md (Facebook activity 10/07–10/10/2026).
// Only totals live here; per-post figures and post text are intentionally left out.

export interface Stat {
  label: string;
  value: string;
  note?: string;
}

export interface GroupCount {
  label: string;
  count: number;
}

export const stats = {
  period: '10/07/2026 – 10/10/2026',
  headline: [
    { label: 'Bài về AI', value: '71' },
    { label: 'Tuần liên tục', value: '13', note: '≈ 5 bài/tuần' },
    { label: 'Reel về AI', value: '11' },
    { label: 'Reel cao nhất', value: '73K', note: 'lượt xem' },
  ] satisfies Stat[],
  byGroup: [
    { label: 'Sản phẩm & dự án tự xây', count: 9 },
    { label: 'Đào tạo & sự kiện', count: 5 },
    { label: 'Video làm bằng AI', count: 5 },
    { label: 'Hướng dẫn, quy trình & mẹo', count: 17 },
    { label: 'Bình luận tin tức AI', count: 35 },
  ] satisfies GroupCount[],
  source: 'Tổng hợp từ bài đăng Facebook cá nhân, thu thập ngày 10/10/2026.',
};

export const byGroupTotal = stats.byGroup.reduce((sum, g) => sum + g.count, 0);
export const byGroupMax = Math.max(...stats.byGroup.map((g) => g.count));
