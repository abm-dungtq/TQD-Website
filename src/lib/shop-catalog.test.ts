import { describe, expect, it } from 'vitest';
import {
  buildZaloOrderMessage,
  DEFAULT_SHOP_STATE,
  filterShopProducts,
  findShopProductBySlug,
  formatVnd,
  monthlyAverageLabel,
  resolveShopSelection,
  SHOP_PRODUCTS,
  SHOP_UPGRADE_REQUIREMENTS,
} from './shop-catalog';

const EXPECTED_PRICE_LIST: Array<[string, number]> = [
  ['Veo 0 cre-1m (Ultra 20X)', 400000],
  ['Veo Random-1m (Ultra 20X)', 550000],
  ['Veo Random-3m (Ultra 20X)', 1600000],
  ['Veo 0 cre-12m (Ultra 20X)', 2850000],
  ['Veo Random-6m (Ultra 20X)', 2650000],
  ['Veo Random-12m (Ultra 20X)', 4200000],
  ['Veo 12k5-12m (Ultra 20X)', 6300000],
  ['Veo 25k-12m (Ultra 20X)', 11600000],
  ['Veo 0 cre-12m (Ultra 5X)', 2200000],
  ['Veo Random-1m (Ultra 5X)', 400000],
  ['Veo Random-3m (Ultra 5X)', 1050000],
  ['Veo Random-12m (Ultra 5X)', 3150000],
  ['Full Fam 10k-6m (Ultra 5X)', 4200000],
  ['Full Fam 10k-12m (Ultra 5X)', 6300000],
  ['Veo Unlimited-1w (Ultra 20X)', 2650000],
  ['Veo Unlimited-1m (Ultra 20X)', 10500000],
  ['Full Fam 25k-3m (Ultra 20X)', 5800000],
  ['Full Fam 25k-6m (Ultra 20X)', 10000000],
  ['Full Fam 25k-12m (Ultra 20X)', 15800000],
  ['Full Fam Unlimited-1m (Ultra 20X)', 52500000],
  ['Veo 25k-1m (Ultra 20X)', 1600000],
  ['Veo 100k-1m (Ultra 20X)', 4200000],
  ['Veo Random 750k-1m (Ultra 20X)', 5250000],
  ['Full Fam 200k-1m (Ultra 20X)', 8400000],
  ['Full Fam 500k-1m (Ultra 20X)', 15800000],
  ['Full Fam 750k-1m (Ultra 20X)', 23600000],
  ['Full Family Ultra 5x-6m 30k Cre', 7350000],
  ['Full Family Ultra 5x-12m 30k Cre', 13700000],
  ['Full Fam 75k-1m (Ultra 20X)', 3950000],
  ['Fam Chính Chủ-12m (Ultra 20X)', 10500000],
];

describe('shop-catalog 30-SKU dataset', () => {
  it('contains all 30 SKUs with exact names, prices, unique slugs, and zero supplier/insecure URL leaks', () => {
    expect(SHOP_PRODUCTS).toHaveLength(30);
    expect(SHOP_PRODUCTS.map((p) => [p.name, p.price])).toEqual(EXPECTED_PRICE_LIST);

    const slugs = new Set(SHOP_PRODUCTS.map((p) => p.slug));
    expect(slugs.size).toBe(30);

    const serialized = JSON.stringify(SHOP_PRODUCTS).toLowerCase();
    expect(serialized).not.toContain('ahki');
    expect(serialized).not.toContain('http://');
    for (const req of SHOP_UPGRADE_REQUIREMENTS) {
      expect(req.checkUrl.startsWith('https://')).toBe(true);
    }
  });

  it('resolves sparse 4-tier combinations deterministically without invalid SKU states', () => {
    const base = resolveShopSelection(DEFAULT_SHOP_STATE);
    expect(base.product.slug).toBe('veo-25k-1m-ultra-20x');

    // Ultra 5x has no Trực tiếp chính chủ upgrade type -> falls back cleanly
    const switchedTo5x = resolveShopSelection({
      plan: 'Google Ultra 5x',
      upgradeType: 'Trực tiếp chính chủ',
      creditKey: '25.000 Credit',
      duration: '1 Tháng',
    });
    expect(switchedTo5x.availableUpgrades).not.toContain('Trực tiếp chính chủ');
    expect(switchedTo5x.product.plan).toBe('Google Ultra 5x');
    expect(switchedTo5x.state.upgradeType).toBe('Slot Family chính chủ');

    // Every possible (plan, upgradeType, creditKey, duration) resolves cleanly
    for (const p of SHOP_PRODUCTS) {
      const r = resolveShopSelection({
        plan: p.plan,
        upgradeType: p.upgradeType,
        creditKey: p.creditKey,
        duration: p.duration,
      });
      expect(r.product.slug).toBe(p.slug);
    }
  });

  it('filters, looks up by slug, and formats VND labels accurately', () => {
    expect(filterShopProducts('all', '')).toHaveLength(30);
    expect(filterShopProducts('slot-20x', '')).toHaveLength(13);
    expect(filterShopProducts('slot-5x', '')).toHaveLength(4);
    expect(filterShopProducts('full', '')).toHaveLength(12);
    expect(filterShopProducts('direct', '')).toHaveLength(1);
    expect(filterShopProducts('all', '750k').length).toBeGreaterThanOrEqual(2);

    const direct = findShopProductBySlug('fam-chinh-chu-12m-ultra-20x');
    expect(direct?.price).toBe(10500000);
    expect(formatVnd(1500000)).toBe('1.500.000đ');
    expect(monthlyAverageLabel(direct!)).toContain('/tháng');
    expect(buildZaloOrderMessage(direct!)).toContain('Fam Chính Chủ-12m (Ultra 20X)');
  });
});
