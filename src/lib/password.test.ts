import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('pbkdf2-sha256$100000$')).toBe(true);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('wrong password here', stored)).toBe(false);
  });

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('anything', 'abc')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });
});
