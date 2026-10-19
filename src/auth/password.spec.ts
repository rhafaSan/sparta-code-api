import { hashPassword, verifyPassword } from './password.js';

describe('Password storage', () => {
  it('uses distinct salts and verifies the full password without trimming', async () => {
    const password = '  Test-password-42  ';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password.trim(), first)).toBe(false);
    expect(await verifyPassword('incorrect', first)).toBe(false);
  });

  it('rejects plaintext, unknown parameters and malformed stored hashes', async () => {
    for (const hash of [
      'plain-password',
      'scrypt$1$8$1$salt$key',
      'scrypt$131072$8$1$bad$bad',
    ]) {
      expect(await verifyPassword('password', hash)).toBe(false);
    }
  });
});
