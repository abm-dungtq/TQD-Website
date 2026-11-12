/**
 * src/lib/analytics/schema.ts
 * Hợp đồng kiểu dữ liệu và danh sách cho phép (allowlist) cho hệ thống thống kê
 * first-party `tqd_analytics` theo `docs/analytics-event-spec.md`.
 */

export const ALLOWED_EVENTS = [
  'page_view',
  'page_end',
  'html_hit',
  'cta_click',
  'outbound_click',
  'chart_generated',
  'interpret_started',
  'interpret_completed',
  'heming_generated',
  'heming_interpret',
  'share_opened',
  'share_action',
  'timenav_used',
  'history_opened',
  'library_search',
  'paywall_view',
  'checkout_start',
  'payment_success',
  'premium_report_view',
] as const;

export type AnalyticsEventName = (typeof ALLOWED_EVENTS)[number];

export const ALLOWED_SECTIONS = [
  'home',
  'chart',
  'heming',
  'library',
  'knowledge',
  'tuvi2027',
  'legal',
  'articles',
  'tools',
  'gallery',
  'other',
] as const;

export type AnalyticsSection = (typeof ALLOWED_SECTIONS)[number];

export const ALLOWED_UTM = [
  'google',
  'facebook',
  'zalo',
  'tiktok',
  'youtube',
  'email',
  'other',
  '',
] as const;

export type AnalyticsUtm = (typeof ALLOWED_UTM)[number];

export type AnalyticsDevice = 'mobile' | 'tablet' | 'desktop';

export const ALLOWED_PAYLOAD_KEYS = [
  'e',
  'p',
  'r',
  'u',
  's',
  'pv',
  'p1',
  'p2',
  'ms',
  'sc',
  'val',
  'wb',
] as const;

export type AllowedPayloadKey = (typeof ALLOWED_PAYLOAD_KEYS)[number];

export interface AnalyticsPayload {
  e: AnalyticsEventName;
  p?: string;
  r?: string;
  u?: string;
  s?: string;
  pv?: string;
  p1?: string;
  p2?: string;
  ms?: number;
  sc?: number;
  val?: number;
  wb?: boolean;
}

export interface SanitizedAnalyticsPayload {
  event: AnalyticsEventName;
  section: AnalyticsSection;
  pathTpl: string;
  path: string;
  refHost: string;
  utm: AnalyticsUtm;
  sid: string;
  pvId: string;
  p1: string;
  p2: string;
  engagedMs: number;
  maxScrollPct: number;
  value: number;
  webdriver: boolean;
}

export interface AnalyticsDataPointInput {
  site: 'tuvi.tqd.me' | 'tqd.me';
  event: AnalyticsEventName;
  section: AnalyticsSection;
  pathTpl: string;
  path: string;
  refHost: string;
  utm: AnalyticsUtm;
  country: string;
  device: AnalyticsDevice;
  sid: string;
  vidDay: string;
  p1: string;
  p2: string;
  isBot: '0' | '1';
  pvId: string;
  engagedMs?: number;
  maxScrollPct?: number;
  latencyMs?: number;
  value?: number;
}
