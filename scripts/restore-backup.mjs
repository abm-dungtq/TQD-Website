// Turns a backups/YYYY-MM-DD.json snapshot into SQL that replaces the content tables.
// Usage: node scripts/restore-backup.mjs <backup.json> <out.sql>
import fs from 'node:fs';

const TABLES = ['settings', 'items', 'articles', 'media', 'api_keys', 'chat_daily'];
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/restore-backup.mjs <backup.json> <out.sql>');
  process.exit(2);
}

const sqlValue = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

const { tables } = JSON.parse(fs.readFileSync(input, 'utf8'));
const lines = [];
for (const name of TABLES) {
  // Backups made before a table existed leave that table as it is.
  if (!(name in tables)) continue;
  lines.push(`DELETE FROM ${name};`);
  for (const row of tables[name]) {
    const cols = Object.keys(row);
    lines.push(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map((c) => sqlValue(row[c])).join(', ')});`);
  }
}
fs.writeFileSync(output, lines.join('\n') + '\n');
console.log(`Wrote ${lines.length} statements to ${output}`);
