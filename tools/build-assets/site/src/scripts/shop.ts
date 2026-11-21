// Client-side controller for /shop: 4-tier configurator, quick presets, 30-SKU filterable table, and Zalo order copy.
import {
  buildZaloOrderMessage,
  DEFAULT_SHOP_STATE,
  filterShopProducts,
  findShopProductBySlug,
  formatVnd,
  monthlyAverageLabel,
  resolveShopSelection,
  SHOP_CREDIT_BADGES,
  SHOP_CREDIT_EXPLANATIONS,
  SHOP_PLAN_META,
  SHOP_PLANS,
  SHOP_UPGRADE_META,
  SHOP_UPGRADE_TYPES,
  type ShopPlan,
  type ShopProduct,
  type ShopTableFilter,
  type ShopUpgradeType,
} from '../lib/shop-catalog';

const state: {
  plan: ShopPlan;
  upgradeType: ShopUpgradeType;
  creditKey: string;
  duration: string;
  tableFilter: ShopTableFilter;
  tableSearch: string;
} = {
  ...DEFAULT_SHOP_STATE,
  tableFilter: 'all',
  tableSearch: '',
};

const el = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

function escAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderRadioCard(
  groupName: string,
  value: string,
  checked: boolean,
  disabled: boolean,
  title: string,
  subText: string,
  extraHtml = '',
): string {
  const safeId = `shop-${groupName}-${value.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
  return `
    <div class="shop-radio-item">
      <input
        type="radio"
        class="shop-radio-input"
        name="${escAttr(groupName)}"
        id="${escAttr(safeId)}"
        value="${escAttr(value)}"
        ${checked ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
      />
      <label class="shop-radio-card" for="${escAttr(safeId)}">
        <span class="shop-radio-check" aria-hidden="true">✓</span>
        <span class="shop-option-title">${escAttr(title)}</span>
        ${subText ? `<span class="shop-option-sub">${escAttr(subText)}</span>` : ''}
        ${extraHtml}
      </label>
    </div>
  `;
}

function flashPriceUpdate(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const id of ['sum-price', 'mob-sum-price']) {
    const node = el(id);
    if (!node) continue;
    node.classList.add('is-updated');
    window.setTimeout(() => node.classList.remove('is-updated'), 260);
  }
}

function renderSummary(product: ShopProduct, announceLive: boolean): void {
  const summaryCard = el('shop-summary-card');
  if (summaryCard) {
    summaryCard.setAttribute('aria-live', announceLive ? 'polite' : 'off');
  }
  const setText = (id: string, value: string) => {
    const node = el(id);
    if (node) node.textContent = value;
  };
  const formattedPrice = formatVnd(product.price);
  setText('sum-category', product.category);
  setText('sum-sku', `#${String(product.index).padStart(2, '0')} · ${product.slug}`);
  setText('sum-name', product.name);
  setText('sum-price', formattedPrice);
  setText('sum-avg', monthlyAverageLabel(product));
  setText('sum-desc', product.shortDescription);

  setText('mob-sum-name', product.name);
  setText('mob-sum-price', formattedPrice);
  setText('mob-sum-meta', `${product.duration} · ${product.credit}`);
  if (announceLive) flashPriceUpdate();

  const isDirect = product.upgradeType === 'Trực tiếp chính chủ';
  const driveBase = product.plan === 'Google Ultra 20x' ? '30 TB Drive' : '20 TB Drive';
  const driveSpec = `${driveBase} ${isDirect ? '(Owner + 5 slot)' : '(dùng chung Family)'}`;

  const rows: Array<[string, string, string, boolean]> = [
    ['Hình thức', `${product.upgradeType.replace(' chính chủ', '')} (${product.users} user)`, '', false],
    ['Thời hạn', `${product.duration} (${product.durationDays} ngày)`, '', false],
    ['Credit Flow', product.credit, '', false],
    ['Kho lưu trữ', driveSpec, 'is-yes', false],
    [
      'Cấp credit & Bảo hành',
      `${product.refillRule} · ${product.deliveryTime} · ${product.warranty}`,
      '',
      true,
    ],
    [
      'Đặc quyền Owner (YouTube · Lower Priority · Cloud)',
      isDirect
        ? 'Có đủ: YouTube Premium cá nhân · Veo 3.1 Lower Priority (0 credit) · 2.000 Colab + $100 Cloud/tháng'
        : 'Không bao gồm (chỉ có trên gói Nâng cấp trực tiếp)',
      isDirect ? 'is-yes' : 'is-no',
      true,
    ],
  ];

  const specsList = el('sum-specs');
  if (specsList) {
    specsList.innerHTML = rows
      .map(
        ([k, v, cls, wide]) =>
          `<li${wide ? ' class="is-wide"' : ''}><span class="shop-spec-key">${escAttr(k)}</span><span class="shop-spec-val${cls ? ` ${cls}` : ''}">${escAttr(v)}</span></li>`,
      )
      .join('');
  }

  const msg = buildZaloOrderMessage(product);
  const zaloBtn = el<HTMLAnchorElement>('btn-zalo-order');
  const mobZaloBtn = el<HTMLAnchorElement>('btn-mob-zalo');
  const copyBtn = el<HTMLButtonElement>('btn-copy-order');
  if (zaloBtn) zaloBtn.dataset.orderText = msg;
  if (mobZaloBtn) mobZaloBtn.dataset.orderText = msg;
  if (copyBtn) copyBtn.dataset.orderText = msg;

  const targetUrl = new URL(window.location.href);
  if (targetUrl.searchParams.get('sku') !== product.slug || targetUrl.hash) {
    targetUrl.searchParams.set('sku', product.slug);
    targetUrl.hash = '';
    window.history.replaceState(null, '', targetUrl.pathname + targetUrl.search);
  }
}

function renderTable(selected: ShopProduct): void {
  const tbody = el('sku-table-body');
  if (!tbody) return;
  const filtered = filterShopProducts(state.tableFilter, state.tableSearch);
  const tableCount = el('table-count');
  if (tableCount) {
    tableCount.textContent = ` · Đang hiển thị ${filtered.length}/30 gói`;
  }
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="7">Không có gói nào khớp bộ lọc hiện tại. Bạn thử xóa từ khóa tìm kiếm.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered
    .map((p) => {
      const active = p.slug === selected.slug;
      const planShort = p.plan.replace('Google ', '');
      const upgradeShort = SHOP_UPGRADE_META[p.upgradeType].label;
      return `
        <tr class="${active ? 'is-active' : ''}">
          <th scope="row">${escAttr(p.name)}</th>
          <td data-label="Dòng &amp; Hình thức">${escAttr(planShort)} · ${escAttr(upgradeShort)}</td>
          <td data-label="Credit Flow">${escAttr(p.credit)}</td>
          <td data-label="Thời hạn">${escAttr(p.duration)}</td>
          <td data-label="Số user">${p.users}</td>
          <td data-label="Giá bán"><strong>${escAttr(formatVnd(p.price))}</strong></td>
          <td data-label="Thao tác">
            <button type="button" class="shop-pick-row-btn${active ? ' is-selected' : ''}" data-pick-slug="${escAttr(p.slug)}">
              ${active ? '✓ Đang chọn' : 'Chọn gói này'}
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function updatePresets(selected: ShopProduct): void {
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.preset === selected.slug));
  });
}

function renderConfigurator(announceLive = true): void {
  const root = el('shop-configurator');
  const activeEl = document.activeElement;
  const focusedRadioName =
    announceLive &&
    root &&
    activeEl instanceof HTMLInputElement &&
    activeEl.type === 'radio' &&
    root.contains(activeEl)
      ? activeEl.name
      : null;

  const resolved = resolveShopSelection(state);
  state.plan = resolved.state.plan;
  state.upgradeType = resolved.state.upgradeType;
  state.creditKey = resolved.state.creditKey;
  state.duration = resolved.state.duration;
  const selected = resolved.product;

  const stepPlan = el('step-plan');
  if (stepPlan) {
    stepPlan.innerHTML = SHOP_PLANS.map((pl) =>
      renderRadioCard('plan', pl, state.plan === pl, false, SHOP_PLAN_META[pl].label, SHOP_PLAN_META[pl].sub),
    ).join('');
  }

  const availUpgrades = new Set(resolved.availableUpgrades);
  const stepUpgrade = el('step-upgrade');
  if (stepUpgrade) {
    stepUpgrade.innerHTML = SHOP_UPGRADE_TYPES.map((up) => {
      const ok = availUpgrades.has(up);
      const sub = ok ? SHOP_UPGRADE_META[up].sub : 'Hiện chỉ có trên dòng Ultra 20x';
      return renderRadioCard(
        'upgradeType',
        up,
        state.upgradeType === up,
        !ok,
        SHOP_UPGRADE_META[up].label,
        sub,
      );
    }).join('');
  }

  const stepCredit = el('step-credit');
  if (stepCredit) {
    stepCredit.innerHTML = resolved.availableCredits
      .map((ck) => {
        const sample = resolved.availableDurations.find((p) => p.creditKey === ck) ??
          filterShopProducts('all', '').find(
            (p) => p.plan === state.plan && p.upgradeType === state.upgradeType && p.creditKey === ck,
          );
        const creditType = sample?.creditType ?? 'fixed';
        const badge = SHOP_CREDIT_BADGES[creditType];
        return renderRadioCard(
          'creditKey',
          ck,
          state.creditKey === ck,
          false,
          ck,
          '',
          `<span class="shop-badge ${badge.cls}">${escAttr(badge.text)}</span>`,
        );
      })
      .join('');
  }

  const callout = el('credit-callout');
  if (callout) {
    const exp = SHOP_CREDIT_EXPLANATIONS[selected.creditType];
    callout.setAttribute('aria-live', announceLive ? 'polite' : 'off');
    callout.dataset.tone = exp.tone;
    callout.innerHTML = `<strong>${escAttr(exp.calloutTitle)}</strong><span>${escAttr(selected.creditNote)}</span>`;
  }

  const stepDuration = el('step-duration');
  if (stepDuration) {
    stepDuration.innerHTML = resolved.availableDurations
      .map((p) =>
        renderRadioCard(
          'duration',
          p.duration,
          state.duration === p.duration,
          false,
          p.duration,
          `${p.users} người dùng · ${p.durationDays} ngày`,
          `<span class="shop-option-price">${escAttr(formatVnd(p.price))}</span>`,
        ),
      )
      .join('');
  }

  renderSummary(selected, announceLive);
  renderTable(selected);
  updatePresets(selected);

  if (focusedRadioName && root) {
    const nextRadio = root.querySelector<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(focusedRadioName)}"]:checked`,
    );
    nextRadio?.focus({ preventScroll: true });
  }
}

function selectBySlug(slug: string, scrollIntoView: boolean): void {
  const found = findShopProductBySlug(slug);
  if (!found) return;
  state.plan = found.plan;
  state.upgradeType = found.upgradeType;
  state.creditKey = found.creditKey;
  state.duration = found.duration;
  renderConfigurator(true);
  if (scrollIntoView) {
    el('shop-configurator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function copyTextWithStatus(text: string): Promise<void> {
  const statusEl = el('copy-status');
  if (!statusEl || !text) return;
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Đã sao chép tên gói và giá vào bộ nhớ tạm.';
  } catch {
    statusEl.textContent = text;
  }
  window.setTimeout(() => {
    if (statusEl) statusEl.textContent = '';
  }, 3500);
}

function initShop(): void {
  const root = el('shop-configurator');
  if (!root) return;

  root.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'radio') return;
    if (target.name === 'plan') state.plan = target.value as ShopPlan;
    else if (target.name === 'upgradeType') state.upgradeType = target.value as ShopUpgradeType;
    else if (target.name === 'creditKey') state.creditKey = target.value;
    else if (target.name === 'duration') state.duration = target.value;
    else return;
    renderConfigurator(true);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.preset;
      if (slug) selectBySlug(slug, false);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tableFilter = (btn.dataset.filter ?? 'all') as ShopTableFilter;
      document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderConfigurator(false);
    });
  });

  el<HTMLInputElement>('table-search')?.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    state.tableSearch = target.value;
    renderConfigurator(false);
  });

  el('sku-table-body')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('[data-pick-slug]');
    if (!btn?.dataset.pickSlug) return;
    selectBySlug(btn.dataset.pickSlug, true);
  });

  el<HTMLButtonElement>('btn-copy-order')?.addEventListener('click', (e) => {
    const text = (e.currentTarget as HTMLButtonElement).dataset.orderText ?? '';
    void copyTextWithStatus(text);
  });

  const handleZaloClick = (e: Event) => {
    const text = (e.currentTarget as HTMLAnchorElement).dataset.orderText ?? '';
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };
  el<HTMLAnchorElement>('btn-zalo-order')?.addEventListener('click', handleZaloClick);
  el<HTMLAnchorElement>('btn-mob-zalo')?.addEventListener('click', handleZaloClick);

  el<HTMLAnchorElement>('btn-mob-detail')?.addEventListener('click', (e) => {
    e.preventDefault();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    el('shop-summary-card')?.scrollIntoView({ behavior, block: 'start' });
  });

  const summaryCard = el('shop-summary-card');
  const mobileBar = el('shop-mobile-bar');
  if (summaryCard && mobileBar && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          mobileBar.classList.toggle('is-docked-hidden', entry.isIntersecting);
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(summaryCard);
  }

  const url = new URL(window.location.href);
  const querySku = url.searchParams.get('sku');
  const hashSku = /^#sku=([a-z0-9-]+)$/.exec(url.hash)?.[1];
  const initialSlug = querySku || hashSku;
  if (initialSlug && findShopProductBySlug(initialSlug)) {
    selectBySlug(initialSlug, false);
  } else {
    renderConfigurator(false);
  }
}

initShop();
