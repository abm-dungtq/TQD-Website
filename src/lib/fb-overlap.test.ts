import { describe, expect, it } from 'vitest';
import { hasFacebookOverlap } from './fb-overlap';
import { normalizeText, windowHash } from './normalize-text';

const sample = 'Hôm nay mình thử dựng một trợ lý AI nhỏ để tự động tổng hợp báo cáo bán hàng cuối ngày cho cả nhóm.';

describe('hasFacebookOverlap', () => {
  it('is false for unrelated text', () => {
    expect(hasFacebookOverlap('Một đoạn văn hoàn toàn khác, không trùng với bất kỳ bài nào trên mạng xã hội cả nhé.')).toBe(false);
  });

  it('is true when a 60-character window matches', () => {
    const norm = normalizeText(sample);
    const set = new Set([windowHash(norm.slice(10, 70))]);
    expect(hasFacebookOverlap(`Mở đầu khác. ${sample} Kết khác.`, set)).toBe(true);
  });
});
