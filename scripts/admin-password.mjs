// Prints a PBKDF2 hash for ADMIN_PASSWORD_HASH. Only the hash goes to stdout.
// Usage:
//   node scripts/admin-password.mjs --generate <file>   random password written to <file>
//   node scripts/admin-password.mjs --from <file>       hash the password stored in <file>
//   node scripts/admin-password.mjs --prompt            type the password (no echo)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { hashPassword } from '../src/lib/password.ts';

const [mode, file] = process.argv.slice(2);

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    process.stderr.write(question);
    rl._writeToOutput = () => {};
    rl.question('', (answer) => {
      rl.close();
      process.stderr.write('\n');
      resolve(answer);
    });
  });

let password;
if (mode === '--generate' && file) {
  password = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64url');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, password);
} else if (mode === '--from' && file) {
  password = fs.readFileSync(file, 'utf8').trim();
} else if (mode === '--prompt') {
  password = await ask('Mật khẩu admin: ');
  if ((await ask('Nhập lại: ')) !== password) {
    console.error('Hai lần nhập không khớp.');
    process.exit(1);
  }
} else {
  console.error('Usage: node scripts/admin-password.mjs --generate <file> | --from <file> | --prompt');
  process.exit(2);
}

if (password.length < 12) {
  console.error('Mật khẩu cần ít nhất 12 ký tự.');
  process.exit(1);
}
console.log(await hashPassword(password));
