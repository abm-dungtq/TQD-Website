// Daily chat counters behind /admin/chat. Counts only: the website never stores what visitors write.

export type ChatOutcome = 'answered' | 'limited' | 'offline' | 'failed';

export interface ChatDay {
  day: string;
  answered: number;
  limited: number;
  offline: number;
  failed: number;
  visitors: number;
}

export interface ChatTotals {
  answered: number;
  limited: number;
  offline: number;
  failed: number;
  visitors: number;
}

/** Today's date in Vietnam (UTC+7), as SQLite computes it. */
const VN_TODAY = "date('now', '+7 hours')";
export const VISITOR_DAYS = 90;

const OUTCOME_COLUMN: Record<ChatOutcome, string> = {
  answered: 'answered',
  limited: 'limited',
  offline: 'offline',
  failed: 'failed',
};

const sha256Hex = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** Counts one chat request; an answered one also marks its visitor as seen today. */
export async function recordChat(db: D1Database, outcome: ChatOutcome, visitorId?: string): Promise<void> {
  const col = OUTCOME_COLUMN[outcome];
  const statements = [
    db.prepare(`INSERT INTO chat_daily (day, ${col}) VALUES (${VN_TODAY}, 1) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + 1`),
  ];
  if (outcome === 'answered' && visitorId) {
    const visitor = (await sha256Hex(`tqd-chat:${visitorId}`)).slice(0, 32);
    statements.push(db.prepare(`INSERT OR IGNORE INTO chat_visitors (day, visitor) VALUES (${VN_TODAY}, ?1)`).bind(visitor));
  }
  await db.batch(statements);
}

/** The last `days` Vietnam dates that had any chat, newest first. */
export async function listChatDays(db: D1Database, days: number): Promise<ChatDay[]> {
  const { results } = await db
    .prepare(
      `SELECT d.day, d.answered, d.limited, d.offline, d.failed,
         (SELECT COUNT(*) FROM chat_visitors v WHERE v.day = d.day) AS visitors
       FROM chat_daily d WHERE d.day > date(${VN_TODAY}, '-${Math.floor(days)} days') ORDER BY d.day DESC`,
    )
    .all<ChatDay>();
  return results;
}

/** Sums over the last `days` days (today included); `null` sums over every recorded day. Visitors are distinct. */
export async function chatTotals(db: D1Database, days: number | null): Promise<ChatTotals> {
  const where = days === null ? '' : `WHERE day > date(${VN_TODAY}, '-${Math.floor(days)} days')`;
  const [sums, visitors] = await db.batch<Record<string, number | null>>([
    db.prepare(`SELECT SUM(answered) AS answered, SUM(limited) AS limited, SUM(offline) AS offline, SUM(failed) AS failed FROM chat_daily ${where}`),
    db.prepare(`SELECT COUNT(DISTINCT visitor) AS visitors FROM chat_visitors ${where}`),
  ]);
  const s = sums.results[0] ?? {};
  return {
    answered: s.answered ?? 0,
    limited: s.limited ?? 0,
    offline: s.offline ?? 0,
    failed: s.failed ?? 0,
    visitors: visitors.results[0]?.visitors ?? 0,
  };
}

/** Nightly: forget which visitors chatted once they are older than the retention window. */
export async function pruneChatVisitors(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM chat_visitors WHERE day <= date(${VN_TODAY}, '-${VISITOR_DAYS} days')`).run();
}
