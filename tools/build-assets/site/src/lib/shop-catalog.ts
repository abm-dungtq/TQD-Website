// Typed 30-SKU catalog & pure configurator helpers for /shop and /shop.md on tqd.me.

export type ShopPlan = 'Google Ultra 20x' | 'Google Ultra 5x';
export type ShopUpgradeType = 'Slot Family chính chủ' | 'Full Family chính chủ' | 'Trực tiếp chính chủ';
export type ShopCreditType = '0' | 'random' | 'fixed' | 'unlimited';
export type ShopTableFilter = 'all' | 'slot-20x' | 'slot-5x' | 'full' | 'direct';

export interface ShopAccessDetails {
  coreTools: string[];
  youtubePremium: string;
  flowLowerPriority: string;
  developerProgram: string;
  googleColab: string;
  androidStudio: string;
}

export interface ShopProduct {
  index: number;
  slug: string;
  name: string;
  price: number;
  currency: 'VND';
  category: string;
  plan: ShopPlan;
  upgradeType: ShopUpgradeType;
  users: number;
  duration: string;
  durationDays: number;
  creditKey: string;
  creditType: ShopCreditType;
  credit: string;
  creditNote: string;
  refillRule: string;
  deliveryTime: string;
  warranty: string;
  shortDescription: string;
  access: ShopAccessDetails;
  tags: string[];
}

export interface ShopCreditExplanation {
  badge: string;
  tone: 'neutral' | 'info' | 'success' | 'gold';
  calloutTitle: string;
  calloutBody: string;
}

export interface ShopUpgradeRequirement {
  step: number;
  title: string;
  detail: string;
  checkUrl: string;
}

export interface ShopWarrantyPolicy {
  summary: string;
  covered: string[];
  excluded: string[];
}

export interface ShopPreset {
  slug: string;
  title: string;
}

export interface ShopFaqItem {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}

export interface ShopSelectionState {
  plan: ShopPlan;
  upgradeType: ShopUpgradeType;
  creditKey: string;
  duration: string;
}

export const SHOP_PLANS: readonly ShopPlan[] = ['Google Ultra 20x', 'Google Ultra 5x'] as const;

export const SHOP_UPGRADE_TYPES: readonly ShopUpgradeType[] = [
  'Slot Family chính chủ',
  'Full Family chính chủ',
  'Trực tiếp chính chủ',
] as const;

export const SHOP_PLAN_META: Record<ShopPlan, { label: string; sub: string }> = {
  'Google Ultra 20x': { label: 'Ultra 20x', sub: '30 TB Drive · Hạn mức AI 20x' },
  'Google Ultra 5x': { label: 'Ultra 5x', sub: '20 TB Drive · Hạn mức AI 5x' },
};

export const SHOP_UPGRADE_META: Record<ShopUpgradeType, { label: string; sub: string }> = {
  'Slot Family chính chủ': { label: 'Slot Family', sub: '1 user · Add vào Gmail bạn' },
  'Full Family chính chủ': { label: 'Full Family', sub: '5 users · Trọn nhóm tự chia' },
  'Trực tiếp chính chủ': { label: 'Nâng cấp trực tiếp', sub: '6 users · Full quyền YouTube, Cloud, Colab' },
};

export const SHOP_CREDIT_BADGES: Record<ShopCreditType, { text: string; cls: string }> = {
  '0': { text: 'Không kèm Credit', cls: 'badge-neutral' },
  random: { text: 'Ngẫu nhiên · Không cố định', cls: 'badge-info' },
  fixed: { text: 'Cố định / tháng', cls: 'badge-success' },
  unlimited: { text: 'Không giới hạn', cls: 'badge-gold' },
};

export const SHOP_CREDIT_ORDER: readonly string[] = [
  '0 Credit',
  'Random 0 - 10.000',
  'Random 0 - 25.000',
  '10.000 / tháng',
  '12.500 Credit',
  '25.000 Credit',
  '25.000 / tháng',
  '30.000 / tháng',
  '75.000 / tháng',
  '100.000 Credit',
  '200.000 / tháng',
  '500.000 / tháng',
  '750.000 / tháng',
  'Random 0 - 750.000',
  'Unlimited',
];

export const SHOP_DURATION_ORDER: readonly string[] = ['7 Ngày', '1 Tháng', '3 Tháng', '6 Tháng', '1 Năm'];

export const SHOP_CREDIT_EXPLANATIONS: Record<ShopCreditType, ShopCreditExplanation> = {
  "0": {
    "badge": "Không kèm Credit",
    "tone": "neutral",
    "calloutTitle": "Gói 0 Credit: Không dùng để tạo video Veo trên Flow",
    "calloutBody": "Gói này chỉ mở khóa bộ công cụ AI (Gemini, Google Antigravity, NotebookLM, Google AI Studio) và kho lưu trữ Google Drive dùng chung của nhóm Family (30 TB với Ultra 20x, 20 TB với Ultra 5x). Bạn chọn gói này nếu chỉ cần làm việc, lập trình hoặc lưu trữ dữ liệu mà không cần dựng video trên Flow."
  },
  "random": {
    "badge": "Ngẫu nhiên · Không cố định",
    "tone": "info",
    "calloutTitle": "Gói Random Credit: Biến động ngẫu nhiên, không bảo hành bù credit",
    "calloutBody": "Lượng credit Flow thực tế nằm ngẫu nhiên trong khoảng công bố (0-10.000, 0-25.000 hoặc 0-750.000) và tính theo số credit bạn đã dùng. Khi dùng hết phần credit hiện có, gói không hỗ trợ refill hay cấp bù thêm credit; các công cụ AI và kho Drive vẫn hoạt động bình thường hết thời hạn."
  },
  "fixed": {
    "badge": "Cố định / tháng",
    "tone": "success",
    "calloutTitle": "Gói Credit cố định: Cam kết dùng đủ số credit đã mua",
    "calloutBody": "Bạn nhận đủ lượng credit đúng như tên gói. Các gói cố định cần nạp bổ sung được hỗ trợ refill từ 9:00 - 23:00 (giờ Việt Nam, GMT+7) cho đến khi đủ định mức bạn đã mua."
  },
  "unlimited": {
    "badge": "Không giới hạn",
    "tone": "gold",
    "calloutTitle": "Gói Unlimited: Refill liên tục trong khung 9:00 - 23:00 (GMT+7)",
    "calloutBody": "Không giới hạn tổng lượng credit trong suốt thời hạn gói. Mỗi khi tài khoản dùng gần hết ngưỡng, mình hỗ trợ refill 25.000 credit/lần từ 9:00 - 23:00 (GMT+7) để bạn dựng video liên tục."
  }
};

export const SHOP_UPGRADE_REQUIREMENTS: readonly ShopUpgradeRequirement[] = [
  {
    "step": 1,
    "title": "Đóng hồ sơ thanh toán Google Payments",
    "detail": "Tài khoản không được có hồ sơ thanh toán đang mở. Bạn kiểm tra và đóng (nếu có) tại đường dẫn bên dưới.",
    "checkUrl": "https://payments.google.com/gp/w/home/settings"
  },
  {
    "step": 2,
    "title": "Không nằm trong nhóm Google Family nào",
    "detail": "Gmail cần nâng cấp phải đang đứng độc lập, không tham gia nhóm gia đình nào khác.",
    "checkUrl": "https://g.co/yourfamily"
  },
  {
    "step": 3,
    "title": "Không có gói Google One đang hoạt động",
    "detail": "Tài khoản chưa đăng ký bất kỳ gói Google One, AI Pro hay AI Ultra nào còn hạn.",
    "checkUrl": "https://one.google.com/about/plans"
  }
];

export const SHOP_USAGE_NOTES: readonly string[] = [
  "Dùng đúng lượng credit của gói đã chọn. Nếu cố tình dùng vượt hạn mức của nhóm, hệ thống sẽ ngắt quyền truy cập và không hoàn tiền.",
  "Không tự ý xóa hoặc kích thành viên khác trong nhóm Family dùng chung. Nếu tự ý thao tác gây lỗi nhóm, đơn hàng sẽ không được bảo hành và không hoàn tiền.",
  "Với các gói cần nạp thêm (refill), hệ thống bổ sung 25.000 credit mỗi lần trong khung 9:00 đến 23:00 (giờ Việt Nam, GMT+7) cho đến khi đủ định mức bạn đã mua."
];

export const SHOP_WARRANTY_POLICY: ShopWarrantyPolicy = {
  "summary": "Mình bảo hành gói dịch vụ suốt thời hạn đã mua (7 ngày, 30 ngày, 90 ngày, 180 ngày hoặc 365 ngày). Thời gian xử lý bảo hành 1 đến 7 ngày làm việc (với gói 7 ngày ưu tiên xử lý trong ngày hoặc bù ngày sử dụng tương ứng nếu gián đoạn từ hệ thống).",
  "covered": [
    "Gói không kích hoạt được hoặc mất quyền truy cập tính năng đã cam kết khi vẫn còn hạn.",
    "Sự cố phát sinh từ hệ thống cấp gói."
  ],
  "excluded": [
    "Chia sẻ 1 slot cho nhiều người hoặc nhiều thiết bị lạ, gửi spam hay vi phạm điều khoản Google.",
    "Tự ý xóa hoặc loại thành viên khác khỏi nhóm Family dùng chung (với gói Full Family, bạn được toàn quyền quản lý 5 slot của mình).",
    "Dùng VPN hoặc địa chỉ IP bị Google gắn cờ bất thường khiến gói bị khóa.",
    "Gói Random credit: khi đã dùng hết số credit hiện có sẽ không refill hoặc cấp bù thêm credit.",
    "Thay đổi chính sách chung từ phía Google áp dụng trên toàn hệ thống."
  ]
};

export const SHOP_PRESETS: readonly ShopPreset[] = [
  { slug: 'veo-0-cre-12m-ultra-20x', title: 'Dùng Gemini, Antigravity & 30 TB Drive tiết kiệm' },
  { slug: 'veo-random-1m-ultra-20x', title: 'Thử làm video Veo 1 tháng giá mềm' },
  { slug: 'veo-25k-12m-ultra-20x', title: 'Làm video đều đặn 25k credit/tháng' },
  { slug: 'fam-chinh-chu-12m-ultra-20x', title: 'Chính chủ Owner 6 người + YouTube + Cloud' },
];

export const SHOP_FAQS: readonly ShopFaqItem[] = [
  {
    question: 'Credit Flow dùng để làm gì? Chat với Gemini hay dùng Google Antigravity có bị trừ không?',
    answer:
      'Credit chỉ dùng khi bạn tạo video hoặc ảnh AI bên trong Google Flow (sử dụng mô hình Veo 3 và Veo 3.1). Việc trò chuyện trên Gemini, lập trình trong Google Antigravity, tóm tắt tài liệu trên NotebookLM hay lưu dữ liệu lên Google Drive hoàn toàn không trừ vào quỹ credit này.',
    defaultOpen: true,
  },
  {
    question: 'Gói 0 Credit khác gì gói Random và gói Cố định?',
    answer:
      'Gói 0 Credit chỉ kích hoạt bộ công cụ AI và kho Drive dùng chung (20 TB hoặc 30 TB), không dùng để render video trên Flow. Gói Random có lượng credit dao động ngẫu nhiên trong khoảng công bố (ví dụ 0 đến 25.000) và không hỗ trợ refill hay cấp bù nếu dùng hết. Gói Cố định cam kết đủ đúng con số ghi trên tên gói (như 12.500, 25.000, 100.000...) nhờ cơ chế refill theo định mức.',
  },
  {
    question: 'Tại sao gói Slot Family và Full Family không có YouTube Premium hay Veo 3.1 Lower Priority?',
    answer:
      'Theo chính sách phân bổ của Google, YouTube Premium cá nhân, chế độ Veo 3.1 Lower Priority (tạo video hàng chờ chậm 0 credit), 100 USD tín dụng Google Cloud và 2.000 credit Colab đi theo tài khoản chủ gói (Owner). Nếu bạn cần toàn bộ quyền lợi này, hãy chọn hình thức Nâng cấp trực tiếp ở Bước 2 (Fam Chính Chủ-12m (Ultra 20X)).',
  },
  {
    question: 'Cơ chế Refill 25.000 credit/lần hoạt động như thế nào?',
    answer:
      'Với các gói cố định dung lượng lớn (75k, 100k, 200k, 500k, 750k, Unlimited...) hoặc gói cần nạp bổ sung, hệ thống sẽ cấp tiếp từng đợt trong khung giờ 9:00 đến 23:00 (GMT+7) cho đến khi bạn nhận đủ số credit đã mua hoặc hết thời hạn đối với gói Unlimited.',
  },
  {
    question: 'Bảo hành gói bao gồm những gì và trường hợp nào bị từ chối?',
    answer:
      'Mình bảo hành gói suốt thời hạn đăng ký (7 ngày, 1 tháng, 3 tháng, 6 tháng hoặc 1 năm) cho các lỗi kích hoạt hoặc mất quyền truy cập do hệ thống cấp gói, thời gian xử lý 1 đến 7 ngày làm việc (gói 7 ngày ưu tiên xử lý trong ngày hoặc bù ngày sử dụng). Bảo hành không áp dụng nếu bạn dùng vượt quá định mức credit được cấp, tự ý xóa thành viên trong nhóm Family dùng chung, chia sẻ 1 slot cho nhiều thiết bị lạ, spam hoặc dùng VPN/IP bị Google đánh dấu vi phạm.',
  },
];

export const SHOP_PRODUCTS: readonly ShopProduct[] = [
  {
    "index": 1,
    "slug": "veo-0-cre-1m-ultra-20x",
    "name": "Veo 0 cre-1m (Ultra 20X)",
    "price": 400000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "0 Credit",
    "creditType": "0",
    "credit": "0 Credit",
    "creditNote": "Không kèm credit tạo video Veo trên Flow. Chỉ dùng các công cụ AI và kho 30 TB Drive dùng chung trong nhóm Family.",
    "refillRule": "Không áp dụng (gói 0 Credit)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x dùng thử 1 tháng trên Gmail chính chủ, không kèm credit tạo video Flow. Hợp với bạn muốn trải nghiệm Gemini, Google Antigravity, NotebookLM và kho 30 TB Drive dùng chung của nhóm ở mức chi phí thấp nhất.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 2,
    "slug": "veo-random-1m-ultra-20x",
    "name": "Veo Random-1m (Ultra 20X)",
    "price": 550000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "Random 0 - 25.000",
    "creditType": "random",
    "credit": "Random 0 - 25.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 25.000 cho gói 1 tháng; không refill và không cấp bù nếu dùng hết.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x thời hạn 1 tháng trên Gmail chính chủ, kèm hạn mức Flow ngẫu nhiên từ 0 đến 25.000 credit. Hợp để làm quen công cụ dựng video Veo trên Flow cùng Gemini, Google Antigravity và kho 30 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 3,
    "slug": "veo-random-3m-ultra-20x",
    "name": "Veo Random-3m (Ultra 20X)",
    "price": 1600000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "3 Tháng",
    "durationDays": 90,
    "creditKey": "Random 0 - 25.000",
    "creditType": "random",
    "credit": "Random 0 - 25.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 25.000/tháng trong 3 tháng; không refill và không cấp bù nếu dùng hết.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (3 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x thời hạn 3 tháng trên Gmail chính chủ với hạn mức Flow ngẫu nhiên 0-25.000 credit/tháng. Đáp ứng tốt nhu cầu dùng Gemini, Google Antigravity, NotebookLM, kho 30 TB Drive dùng chung và tạo video Veo không quá dày.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 4,
    "slug": "veo-0-cre-12m-ultra-20x",
    "name": "Veo 0 cre-12m (Ultra 20X)",
    "price": 2850000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "0 Credit",
    "creditType": "0",
    "credit": "0 Credit",
    "creditNote": "Không kèm credit Flow/Veo; tập trung vào quyền dùng Gemini, Google Antigravity, NotebookLM, AI Studio và kho 30 TB Drive dùng chung suốt 12 tháng.",
    "refillRule": "Không áp dụng (gói 0 Credit)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "1 slot Family Google AI Ultra 20x trọn 1 năm trên Gmail chính chủ, không kèm credit tạo video Flow. Lựa chọn tiết kiệm nhất nếu bạn dùng Gemini, Google Antigravity, NotebookLM và kho 30 TB Drive dùng chung hằng ngày mà không cần dựng phim trên Veo.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 5,
    "slug": "veo-random-6m-ultra-20x",
    "name": "Veo Random-6m (Ultra 20X)",
    "price": 2650000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "6 Tháng",
    "durationDays": 180,
    "creditKey": "Random 0 - 25.000",
    "creditType": "random",
    "credit": "Random 0 - 25.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 25.000/tháng trong 6 tháng; không refill và không cấp bù nếu dùng hết.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (6 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x thời hạn 6 tháng trên Gmail chính chủ, kèm hạn mức Flow ngẫu nhiên 0-25.000 credit/tháng cùng bộ công cụ Gemini, Google Antigravity, NotebookLM và kho 30 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 6,
    "slug": "veo-random-12m-ultra-20x",
    "name": "Veo Random-12m (Ultra 20X)",
    "price": 4200000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "Random 0 - 25.000",
    "creditType": "random",
    "credit": "Random 0 - 25.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 25.000/tháng trong 12 tháng; không refill và không cam kết hạn mức tối thiểu.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "1 slot Family Google AI Ultra 20x trọn 1 năm trên Gmail chính chủ, kèm hạn mức Flow ngẫu nhiên 0-25.000 credit/tháng. Chi phí chia theo tháng chỉ khoảng 350.000đ để dùng toàn bộ hệ sinh thái AI Ultra 20x và kho 30 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 7,
    "slug": "veo-12k5-12m-ultra-20x",
    "name": "Veo 12k5-12m (Ultra 20X)",
    "price": 6300000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "12.500 Credit",
    "creditType": "fixed",
    "credit": "12.500 / tháng",
    "creditNote": "Cam kết đúng 12.500 credit cố định mỗi tháng trong 12 tháng. Không dùng vượt hạn mức của gói (vi phạm lần 1 tạm khóa 30 ngày, lần 2 hủy gói không hoàn tiền).",
    "refillRule": "Hỗ trợ cấp/bổ sung đủ 12.500 credit/tháng (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "1 slot Family Google AI Ultra 20x trọn 1 năm với 12.500 credit cố định mỗi tháng. Dành cho bạn làm nội dung hoặc dựng video Veo đều đặn hàng tuần nhưng chưa cần dùng hết mức 25.000 credit/tháng.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 8,
    "slug": "veo-25k-12m-ultra-20x",
    "name": "Veo 25k-12m (Ultra 20X)",
    "price": 11600000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "25.000 Credit",
    "creditType": "fixed",
    "credit": "25.000 / tháng",
    "creditNote": "Cam kết đủ 25.000 credit cố định mỗi tháng trong suốt 12 tháng.",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "1 slot Family Google AI Ultra 20x trọn 1 năm với trọn vẹn 25.000 credit cố định mỗi tháng. Phù hợp với nhà sáng tạo nội dung sản xuất video Veo trên Flow thường xuyên suốt cả năm.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 9,
    "slug": "veo-0-cre-12m-ultra-5x",
    "name": "Veo 0 cre-12m (Ultra 5X)",
    "price": 2200000,
    "currency": "VND",
    "category": "Slot Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "0 Credit",
    "creditType": "0",
    "credit": "0 Credit",
    "creditNote": "Không kèm credit tạo video Flow/Veo; dùng toàn bộ quyền lợi Google Ultra 5x và kho 20 TB Drive dùng chung trong 12 tháng.",
    "refillRule": "Không áp dụng (gói 0 Credit)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "1 slot Family Google AI Ultra 5x trọn 1 năm trên Gmail chính chủ, không kèm credit Flow. Phù hợp cho nhu cầu dùng Gemini, Google Antigravity, NotebookLM, AI Studio và kho 20 TB Drive dùng chung với ngân sách tiết kiệm.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 10,
    "slug": "veo-random-1m-ultra-5x",
    "name": "Veo Random-1m (Ultra 5X)",
    "price": 400000,
    "currency": "VND",
    "category": "Slot Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "Random 0 - 10.000",
    "creditType": "random",
    "credit": "Random 0 - 10.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 10.000 trong 1 tháng; không refill và không cấp bù khi dùng hết.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 5x thời hạn 1 tháng trên Gmail chính chủ, kèm hạn mức Flow ngẫu nhiên 0-10.000 credit và kho 20 TB Drive dùng chung. Dễ dùng để trải nghiệm thử hệ sinh thái Ultra 5x trong ngắn hạn.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 11,
    "slug": "veo-random-3m-ultra-5x",
    "name": "Veo Random-3m (Ultra 5X)",
    "price": 1050000,
    "currency": "VND",
    "category": "Slot Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "3 Tháng",
    "durationDays": 90,
    "creditKey": "Random 0 - 10.000",
    "creditType": "random",
    "credit": "Random 0 - 10.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 10.000/tháng trong 3 tháng; không refill và không cấp bù nếu dùng hết.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (3 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 5x thời hạn 3 tháng trên Gmail chính chủ, kèm hạn mức Flow ngẫu nhiên 0-10.000 credit/tháng, bộ công cụ AI Google và kho 20 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 12,
    "slug": "veo-random-12m-ultra-5x",
    "name": "Veo Random-12m (Ultra 5X)",
    "price": 3150000,
    "currency": "VND",
    "category": "Slot Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "Random 0 - 10.000",
    "creditType": "random",
    "credit": "Random 0 - 10.000",
    "creditNote": "Credit Flow ngẫu nhiên từ 0 đến 10.000/tháng trong 12 tháng; không refill và không cam kết hạn mức cố định.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "1 slot Family Google AI Ultra 5x trọn 1 năm trên Gmail chính chủ với hạn mức Flow ngẫu nhiên 0-10.000 credit/tháng cùng Gemini, Google Antigravity, NotebookLM và kho 20 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 13,
    "slug": "full-fam-10k-6m-ultra-5x",
    "name": "Full Fam 10k-6m (Ultra 5X)",
    "price": 4200000,
    "currency": "VND",
    "category": "Full Family Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "6 Tháng",
    "durationDays": 180,
    "creditKey": "10.000 / tháng",
    "creditType": "fixed",
    "credit": "10.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 tài khoản Google dùng chung 10.000 credit cố định mỗi tháng trong 6 tháng.",
    "refillRule": "Không cần refill (Google cấp sẵn 10.000 credit/tháng)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (6 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 5x cho tối đa 5 người dùng trong 6 tháng, gồm 10.000 credit/tháng dùng chung cho cả nhóm và 20 TB Google Drive. Phù hợp với nhóm nhỏ hoặc công ty muốn chủ động phân bổ 5 slot.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 14,
    "slug": "full-fam-10k-12m-ultra-5x",
    "name": "Full Fam 10k-12m (Ultra 5X)",
    "price": 6300000,
    "currency": "VND",
    "category": "Full Family Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "10.000 / tháng",
    "creditType": "fixed",
    "credit": "10.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 tài khoản Google dùng chung 10.000 credit cố định mỗi tháng trong 12 tháng.",
    "refillRule": "Không cần refill (Google cấp sẵn 10.000 credit/tháng)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 5x cho tối đa 5 người dùng suốt 1 năm, kèm 10.000 credit/tháng cho cả nhóm và 20 TB Drive. Tính ra chỉ 105.000đ/người/tháng cho cả 5 thành viên.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 15,
    "slug": "veo-unlimited-1w-ultra-20x",
    "name": "Veo Unlimited-1w (Ultra 20X)",
    "price": 2650000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "7 Ngày",
    "durationDays": 7,
    "creditKey": "Unlimited",
    "creditType": "unlimited",
    "credit": "Unlimited",
    "creditNote": "Không giới hạn tổng lượng credit trong 7 ngày, cấp qua cơ chế refill liên tục trong giờ hỗ trợ.",
    "refillRule": "Refill 25.000 credit/lần liên tục (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (7 ngày)",
    "shortDescription": "1 slot Family Google AI Ultra 20x không giới hạn credit trong 7 ngày. Thiết kế riêng cho đợt chạy dự án gấp hoặc dựng hàng loạt clip Veo trong một tuần mà không lo chạm trần credit (ưu tiên xử lý bảo hành trong ngày nếu gặp lỗi hệ thống).",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 16,
    "slug": "veo-unlimited-1m-ultra-20x",
    "name": "Veo Unlimited-1m (Ultra 20X)",
    "price": 10500000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "Unlimited",
    "creditType": "unlimited",
    "credit": "Unlimited",
    "creditNote": "Không giới hạn tổng credit trong 1 tháng cho 1 người dùng thông qua cơ chế refill định kỳ.",
    "refillRule": "Refill 25.000 credit/lần liên tục (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x không giới hạn credit suốt 1 tháng cho 1 người dùng. Tự động refill 25.000 credit/lần trong khung 9h-23h (GMT+7) để bạn sản xuất video AI liên tục.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 17,
    "slug": "full-fam-25k-3m-ultra-20x",
    "name": "Full Fam 25k-3m (Ultra 20X)",
    "price": 5800000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "3 Tháng",
    "durationDays": 90,
    "creditKey": "25.000 / tháng",
    "creditType": "fixed",
    "credit": "25.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng chung 25.000 credit cố định mỗi tháng trong 3 tháng.",
    "refillRule": "Không cần refill (Google cấp sẵn 25.000 credit/tháng)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (3 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho tối đa 5 người dùng trong 3 tháng, kèm 25.000 credit/tháng cho cả nhóm và 30 TB Drive. Gọn nhẹ cho team nhỏ muốn test quy trình AI trong một quý.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 18,
    "slug": "full-fam-25k-6m-ultra-20x",
    "name": "Full Fam 25k-6m (Ultra 20X)",
    "price": 10000000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "6 Tháng",
    "durationDays": 180,
    "creditKey": "25.000 / tháng",
    "creditType": "fixed",
    "credit": "25.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng chung 25.000 credit cố định mỗi tháng trong 6 tháng.",
    "refillRule": "Không cần refill (Google cấp sẵn 25.000 credit/tháng)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (6 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho tối đa 5 người dùng trong 6 tháng, gồm 25.000 credit/tháng cho cả nhóm và 30 TB Drive.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 19,
    "slug": "full-fam-25k-12m-ultra-20x",
    "name": "Full Fam 25k-12m (Ultra 20X)",
    "price": 15800000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "25.000 / tháng",
    "creditType": "fixed",
    "credit": "25.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng chung 25.000 credit cố định mỗi tháng trong suốt 12 tháng.",
    "refillRule": "Không cần refill (Google cấp sẵn 25.000 credit/tháng)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho tối đa 5 người dùng suốt 1 năm, gồm 25.000 credit/tháng cho cả nhóm và 30 TB Drive. Chi phí bình quân chỉ khoảng 263.000đ/người/tháng.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 20,
    "slug": "full-fam-unlimited-1m-ultra-20x",
    "name": "Full Fam Unlimited-1m (Ultra 20X)",
    "price": 52500000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "Unlimited",
    "creditType": "unlimited",
    "credit": "Unlimited",
    "creditNote": "Gói cao cấp nhất cho đội ngũ 5 thành viên: dùng credit Flow không giới hạn trong 1 tháng.",
    "refillRule": "Refill 25.000 credit/lần liên tục (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x không giới hạn credit cho 5 người dùng trong 1 tháng. Dành cho studio hoặc agency dựng video AI công suất lớn cần nạp credit liên tục mỗi ngày.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 21,
    "slug": "veo-25k-1m-ultra-20x",
    "name": "Veo 25k-1m (Ultra 20X)",
    "price": 1600000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "25.000 Credit",
    "creditType": "fixed",
    "credit": "25.000 / tháng",
    "creditNote": "Cam kết đủ 25.000 credit cố định trong 1 tháng cho 1 người dùng.",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x thời hạn 1 tháng trên Gmail chính chủ, cam kết đủ 25.000 credit cố định để dùng Flow/Veo cùng Gemini, Google Antigravity và kho 30 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 22,
    "slug": "veo-100k-1m-ultra-20x",
    "name": "Veo 100k-1m (Ultra 20X)",
    "price": 4200000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "100.000 Credit",
    "creditType": "fixed",
    "credit": "100.000 / tháng",
    "creditNote": "Cam kết tổng định mức 100.000 credit trong 1 tháng cho 1 người dùng, refill từng đợt 25.000 credit đến khi đủ.",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7) đến khi đủ 100.000",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x thời hạn 1 tháng với 100.000 credit cố định (refill 25.000 credit/lần từ 9h-23h GMT+7). Hợp với người làm video AI số lượng lớn muốn kiểm soát chi phí theo tháng.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 23,
    "slug": "veo-random-750k-1m-ultra-20x",
    "name": "Veo Random 750k-1m (Ultra 20X)",
    "price": 5250000,
    "currency": "VND",
    "category": "Slot Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Slot Family chính chủ",
    "users": 1,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "Random 0 - 750.000",
    "creditType": "random",
    "credit": "Random 0 - 750.000",
    "creditNote": "Hạn mức ngẫu nhiên trong khoảng 0 đến 750.000 credit cho 1 tháng; không refill và không cấp bù khi dùng hết phần credit hiện có.",
    "refillRule": "Không hỗ trợ refill (dùng theo hạn mức hiện có)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "1 slot Family Google AI Ultra 20x thời hạn 1 tháng trên Gmail chính chủ với gói Random 0-750.000 credit cho 1 người dùng, kèm quyền truy cập Gemini, Google Antigravity, NotebookLM và kho 30 TB Drive dùng chung.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 24,
    "slug": "full-fam-200k-1m-ultra-20x",
    "name": "Full Fam 200k-1m (Ultra 20X)",
    "price": 8400000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "200.000 / tháng",
    "creditType": "fixed",
    "credit": "200.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng, tổng định mức 200.000 credit trong 1 tháng (refill 25.000 credit/lần đến khi đủ).",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7) đến khi đủ 200.000",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho 5 người dùng trong 1 tháng với 200.000 credit (refill 25.000 credit/lần từ 9h-23h GMT+7) và 30 TB Drive.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 25,
    "slug": "full-fam-500k-1m-ultra-20x",
    "name": "Full Fam 500k-1m (Ultra 20X)",
    "price": 15800000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "500.000 / tháng",
    "creditType": "fixed",
    "credit": "500.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng, tổng định mức 500.000 credit trong 1 tháng (refill đến khi đủ 500.000).",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7) đến khi đủ 500.000",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho 5 người dùng trong 1 tháng với tổng 500.000 credit (refill 25.000/lần từ 9h-23h GMT+7), phục vụ xưởng sản xuất video AI.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 26,
    "slug": "full-fam-750k-1m-ultra-20x",
    "name": "Full Fam 750k-1m (Ultra 20X)",
    "price": 23600000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "750.000 / tháng",
    "creditType": "fixed",
    "credit": "750.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng, tổng định mức 750.000 credit trong 1 tháng (refill đến khi đủ 750.000).",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7) đến khi đủ 750.000",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho 5 người dùng trong 1 tháng với tổng 750.000 credit (refill 25.000/lần từ 9h-23h GMT+7) và 30 TB Drive.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 27,
    "slug": "full-family-ultra-5x-6m-30k-cre",
    "name": "Full Family Ultra 5x-6m 30k Cre",
    "price": 7350000,
    "currency": "VND",
    "category": "Full Family Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "6 Tháng",
    "durationDays": 180,
    "creditKey": "30.000 / tháng",
    "creditType": "fixed",
    "credit": "30.000 / tháng / Family",
    "creditNote": "Trọn nhóm Full Family Google Ultra 5x cho 5 người dùng trong 6 tháng, định mức 30.000 credit/tháng cho cả nhóm.",
    "refillRule": "Refill đến đủ 30.000 credit/tháng (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (6 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 5x cho 5 người dùng trong 6 tháng với 30.000 credit/tháng (gấp 3 lần mức 10.000 chuẩn) và 20 TB Google Drive.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 28,
    "slug": "full-family-ultra-5x-12m-30k-cre",
    "name": "Full Family Ultra 5x-12m 30k Cre",
    "price": 13700000,
    "currency": "VND",
    "category": "Full Family Google Ultra 5x",
    "plan": "Google Ultra 5x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "30.000 / tháng",
    "creditType": "fixed",
    "credit": "30.000 / tháng / Family",
    "creditNote": "Trọn nhóm Full Family Google Ultra 5x cho 5 người dùng trong 12 tháng, định mức 30.000 credit/tháng cho cả nhóm.",
    "refillRule": "Refill đến đủ 30.000 credit/tháng (9:00 - 23:00 GMT+7)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 5x cho 5 người dùng suốt 1 năm với 30.000 credit/tháng cho cả nhóm và 20 TB Google Drive.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "20 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 29,
    "slug": "full-fam-75k-1m-ultra-20x",
    "name": "Full Fam 75k-1m (Ultra 20X)",
    "price": 3950000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Full Family chính chủ",
    "users": 5,
    "duration": "1 Tháng",
    "durationDays": 30,
    "creditKey": "75.000 / tháng",
    "creditType": "fixed",
    "credit": "75.000 / tháng / Family",
    "creditNote": "Trọn nhóm 5 người dùng, tổng định mức 75.000 credit trong 1 tháng (refill 25.000 credit/lần đến khi đủ).",
    "refillRule": "Refill 25.000 credit/lần (9:00 - 23:00 GMT+7) đến khi đủ 75.000",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 tháng)",
    "shortDescription": "Trọn nhóm Full Family Google AI Ultra 20x cho 5 người dùng trong 1 tháng với 75.000 credit (refill 25.000/lần từ 9h-23h GMT+7) và 30 TB Drive dùng chung. Mức dung lượng trung gian hợp lý trước khi lên gói 200k.",
    "access": {
      "coreTools": [
        "Gemini (quyền lợi Ultra)",
        "Google Antigravity",
        "NotebookLM",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos (dùng chung nhóm Family)"
      ],
      "youtubePremium": "Không bao gồm YouTube Premium cá nhân",
      "flowLowerPriority": "Không bao gồm chế độ Veo 3.1 Lower Priority (0 credit)",
      "developerProgram": "Không bao gồm",
      "googleColab": "Không bao gồm",
      "androidStudio": "Không bao gồm"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  },
  {
    "index": 30,
    "slug": "fam-chinh-chu-12m-ultra-20x",
    "name": "Fam Chính Chủ-12m (Ultra 20X)",
    "price": 10500000,
    "currency": "VND",
    "category": "Full Family Google Ultra 20x",
    "plan": "Google Ultra 20x",
    "upgradeType": "Trực tiếp chính chủ",
    "users": 6,
    "duration": "1 Năm",
    "durationDays": 365,
    "creditKey": "25.000 / tháng",
    "creditType": "fixed",
    "credit": "25.000 / tháng / Family",
    "creditNote": "Nâng cấp trực tiếp trên Gmail chính chủ của bạn (hoặc cấp tài khoản Owner có sẵn gói) với 25.000 credit/tháng, tối đa 6 người dùng (1 Owner + 5 thành viên). Bao gồm YouTube Premium cá nhân, Veo 3.1 Lower Priority (tạo video không tốn credit), 100 USD Google Cloud/tháng (thêm thẻ xác minh sau khi nâng cấp) và 2.000 Colab/tháng.",
    "refillRule": "Không cần refill (cấp sẵn 25.000 credit/tháng trên gói Owner)",
    "deliveryTime": "Hoàn thành trong vòng 24 giờ",
    "warranty": "Bảo hành gói suốt thời hạn (1 năm)",
    "shortDescription": "Gói nâng cấp trực tiếp chính chủ Google AI Ultra 20x suốt 1 năm cho tối đa 6 người dùng (1 chủ nhóm + 5 thành viên). Mở khóa toàn bộ quyền lợi Owner gồm 25.000 credit/tháng, YouTube Premium cá nhân, Veo 3.1 Lower Priority, 100 USD Google Cloud/tháng, 2.000 Colab/tháng và 30 TB Drive (áp dụng điều kiện tài khoản sạch trước khi nâng cấp).",
    "access": {
      "coreTools": [
        "Gemini 4 Argon (hạn mức cao nhất)",
        "Google Antigravity (đầy đủ model)",
        "NotebookLM (hạn mức tối đa)",
        "Google AI Studio & Genius",
        "Flow (Veo) & Whisk",
        "30 TB Google Drive & Photos"
      ],
      "youtubePremium": "Có: YouTube Premium cá nhân suốt thời hạn gói",
      "flowLowerPriority": "Có: Veo 3.1 Lower Priority (tạo video hàng chờ chậm không tốn credit)",
      "developerProgram": "Có: Google Developer Program Premium (100 USD tín dụng Google Cloud/tháng, bạn tự thêm thẻ xác minh)",
      "googleColab": "Có: 2.000 đơn vị điện toán/tháng",
      "androidStudio": "Có: Hạn mức sử dụng cao nhất"
    },
    "tags": [
      "google",
      "google ultra",
      "google pro",
      "antigravity",
      "notebooklm",
      "gemini",
      "flow",
      "veo",
      "whisk",
      "30tb",
      "google one"
    ]
  }
];

const SHOP_BY_SLUG = new Map<string, ShopProduct>(SHOP_PRODUCTS.map((p) => [p.slug, p]));

export const DEFAULT_SHOP_STATE: ShopSelectionState = {
  plan: 'Google Ultra 20x',
  upgradeType: 'Slot Family chính chủ',
  creditKey: '25.000 Credit',
  duration: '1 Tháng',
};

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

export function monthlyAverageLabel(product: ShopProduct): string {
  if (product.durationDays === 365) return `(~${formatVnd(Math.round(product.price / 12))}/tháng)`;
  if (product.durationDays === 180) return `(~${formatVnd(Math.round(product.price / 6))}/tháng)`;
  if (product.durationDays === 90) return `(~${formatVnd(Math.round(product.price / 3))}/tháng)`;
  if (product.durationDays === 30) return 'Thanh toán theo tháng';
  return `Gói dùng ngắn ngày (${product.duration})`;
}

export function findShopProductBySlug(slug: string): ShopProduct | undefined {
  if (typeof slug !== 'string') return undefined;
  return SHOP_BY_SLUG.get(slug.trim());
}

/** Resolves sparse 4-tier choices deterministically into a valid ShopSelectionState and matching ShopProduct. */
export function resolveShopSelection(input: Partial<ShopSelectionState>): {
  state: ShopSelectionState;
  product: ShopProduct;
  availableUpgrades: ShopUpgradeType[];
  availableCredits: string[];
  availableDurations: ShopProduct[];
} {
  const plan: ShopPlan =
    input.plan && SHOP_PLANS.includes(input.plan) ? input.plan : DEFAULT_SHOP_STATE.plan;

  const byPlan = SHOP_PRODUCTS.filter((p) => p.plan === plan);
  const availableUpgrades = SHOP_UPGRADE_TYPES.filter((u) => byPlan.some((p) => p.upgradeType === u));
  const upgradeType: ShopUpgradeType =
    input.upgradeType && availableUpgrades.includes(input.upgradeType)
      ? input.upgradeType
      : availableUpgrades[0];

  const byUpgrade = byPlan.filter((p) => p.upgradeType === upgradeType);
  const availableCredits = [...new Set(byUpgrade.map((p) => p.creditKey))].sort(
    (a, b) => SHOP_CREDIT_ORDER.indexOf(a) - SHOP_CREDIT_ORDER.indexOf(b),
  );
  const creditKey =
    input.creditKey && availableCredits.includes(input.creditKey)
      ? input.creditKey
      : availableCredits.find((c) => c.includes('25.000')) ?? availableCredits[0];

  const availableDurations = byUpgrade
    .filter((p) => p.creditKey === creditKey)
    .sort((a, b) => SHOP_DURATION_ORDER.indexOf(a.duration) - SHOP_DURATION_ORDER.indexOf(b.duration));
  const selected =
    (input.duration ? availableDurations.find((p) => p.duration === input.duration) : undefined) ??
    availableDurations[0];

  return {
    state: {
      plan,
      upgradeType,
      creditKey,
      duration: selected.duration,
    },
    product: selected,
    availableUpgrades,
    availableCredits,
    availableDurations,
  };
}

export function filterShopProducts(filter: ShopTableFilter, query: string): ShopProduct[] {
  const q = query.trim().toLowerCase();
  return SHOP_PRODUCTS.filter((p) => {
    if (filter === 'slot-20x' && !(p.plan === 'Google Ultra 20x' && p.upgradeType === 'Slot Family chính chủ')) {
      return false;
    }
    if (filter === 'slot-5x' && !(p.plan === 'Google Ultra 5x' && p.upgradeType === 'Slot Family chính chủ')) {
      return false;
    }
    if (filter === 'full' && p.upgradeType !== 'Full Family chính chủ') return false;
    if (filter === 'direct' && p.upgradeType !== 'Trực tiếp chính chủ') return false;
    if (q) {
      const hay = `${p.name} ${p.slug} ${p.plan} ${p.credit} ${p.duration} ${p.upgradeType}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function buildZaloOrderMessage(product: ShopProduct): string {
  return `Chào Dũng, mình muốn đặt gói "${product.name}" giá ${formatVnd(product.price)} (${product.plan}, ${product.upgradeType}, ${product.duration}).`;
}
