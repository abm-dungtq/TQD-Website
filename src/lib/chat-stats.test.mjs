import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { chatTotals, listChatDays, pruneChatVisitors, recordChat } from './chat-stats';

// Just enough of D1 over node:sqlite to run the real SQL and migration.
// Plain JS because the project ships Worker types, not Node's.
function fakeD1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => sqlite.prepare(sql).run(...params),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (list) => Promise.all(list.map((s) => s.all())),
  };
}

let sqlite;
let db;
const vnDaysAgo = (n) => sqlite.prepare(`SELECT date('now', '+7 hours', '-${n} days') AS d`).get().d;
const vnToday = () => vnDaysAgo(0);

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0004_chat_stats.sql', 'utf8'));
  db = fakeD1(sqlite);
});

describe('recordChat', () => {
  it('counts each outcome on the Vietnam date and visitors once per day', async () => {
    await recordChat(db, 'answered', 'visitor-a');
    await recordChat(db, 'answered', 'visitor-a');
    await recordChat(db, 'answered', 'visitor-b');
    await recordChat(db, 'limited', 'visitor-c');
    await recordChat(db, 'offline');
    await recordChat(db, 'failed', 'visitor-a');

    expect(await listChatDays(db, 30)).toEqual([
      { day: vnToday(), answered: 3, limited: 1, offline: 1, failed: 1, visitors: 2 },
    ]);
  });

  it('stores a hash, not the visitor id', async () => {
    await recordChat(db, 'answered', 'visitor-a');
    const row = sqlite.prepare('SELECT visitor FROM chat_visitors').get();
    expect(row.visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(row.visitor).not.toContain('visitor-a');
  });
});

describe('chatTotals and listChatDays', () => {
  beforeEach(() => {
    const day = sqlite.prepare('INSERT INTO chat_daily (day, answered, limited, offline, failed) VALUES (?, ?, ?, ?, ?)');
    const visitor = sqlite.prepare('INSERT INTO chat_visitors (day, visitor) VALUES (?, ?)');
    day.run(vnToday(), 5, 1, 0, 0);
    day.run(vnDaysAgo(3), 4, 0, 2, 1);
    day.run(vnDaysAgo(40), 10, 0, 0, 0);
    visitor.run(vnToday(), 'a');
    visitor.run(vnToday(), 'b');
    visitor.run(vnDaysAgo(3), 'a');
    visitor.run(vnDaysAgo(40), 'c');
  });

  it('sums a window that includes today and counts distinct visitors', async () => {
    expect(await chatTotals(db, 1)).toEqual({ answered: 5, limited: 1, offline: 0, failed: 0, visitors: 2 });
    expect(await chatTotals(db, 7)).toEqual({ answered: 9, limited: 1, offline: 2, failed: 1, visitors: 2 });
    expect(await chatTotals(db, null)).toEqual({ answered: 19, limited: 1, offline: 2, failed: 1, visitors: 3 });
  });

  it('returns zeros when nothing was recorded', async () => {
    sqlite.exec('DELETE FROM chat_daily; DELETE FROM chat_visitors;');
    expect(await chatTotals(db, 30)).toEqual({ answered: 0, limited: 0, offline: 0, failed: 0, visitors: 0 });
  });

  it('lists days newest first within the window', async () => {
    expect((await listChatDays(db, 30)).map((d) => [d.day, d.visitors])).toEqual([
      [vnToday(), 2],
      [vnDaysAgo(3), 1],
    ]);
  });
});

describe('pruneChatVisitors', () => {
  it('forgets visitors older than 90 days and keeps the daily counts', async () => {
    sqlite.prepare('INSERT INTO chat_daily (day, answered) VALUES (?, 1)').run(vnDaysAgo(90));
    sqlite.prepare('INSERT INTO chat_visitors (day, visitor) VALUES (?, ?)').run(vnDaysAgo(90), 'old');
    sqlite.prepare('INSERT INTO chat_visitors (day, visitor) VALUES (?, ?)').run(vnDaysAgo(89), 'recent');
    await pruneChatVisitors(db);
    expect(sqlite.prepare('SELECT visitor FROM chat_visitors').all()).toEqual([{ visitor: 'recent' }]);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM chat_daily').get()).toEqual({ n: 1 });
  });
});
