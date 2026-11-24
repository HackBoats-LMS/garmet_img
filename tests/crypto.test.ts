import { test } from 'node:test';
import assert from 'node:assert';
import { encryptValue, decryptValue, maskSecret } from '../lib/crypto';

test('AES-256-GCM Encryption and Decryption Suite', async (t) => {
  await t.test('encrypts and decrypts secrets round-trip cleanly', () => {
    const rawApiKey = 'kie_live_secret_key_884192841';
    const encrypted = encryptValue(rawApiKey);

    assert.ok(encrypted.startsWith('enc:'), 'Encrypted output should start with enc: prefix');
    const parts = encrypted.split(':');
    assert.strictEqual(parts.length, 4, 'Encrypted output must have 4 colon-separated parts');
    assert.strictEqual(parts[1].length, 24, 'IV must be 12 bytes (24 hex characters)');
    assert.strictEqual(parts[2].length, 32, 'Auth tag must be 16 bytes (32 hex characters)');

    const decrypted = decryptValue(encrypted);
    assert.strictEqual(decrypted, rawApiKey, 'Decrypted value should exactly match original');
  });

  await t.test('handles non-encrypted and legacy fallback gracefully', () => {
    assert.strictEqual(decryptValue('plaintext_api_key_123'), 'plaintext_api_key_123');
    assert.strictEqual(decryptValue(''), '');
    assert.strictEqual(encryptValue(''), '');
  });

  await t.test('detects tampered ciphertext and fails closed safely', () => {
    const rawApiKey = 'super_secret_payload';
    const encrypted = encryptValue(rawApiKey);
    const parts = encrypted.split(':');
    
    // Tamper ciphertext
    const tampered = `enc:${parts[1]}:${parts[2]}:deadbeef`;
    const result = decryptValue(tampered);
    assert.strictEqual(result, '', 'Tampered payload must fail decryption and return empty string');
  });

  await t.test('masks secrets properly for secure admin UI presentation', () => {
    assert.strictEqual(maskSecret(''), '');
    assert.strictEqual(maskSecret('12345'), '••••••');
    assert.strictEqual(maskSecret('1234567890'), '12••••90');
    assert.strictEqual(maskSecret('sk_live_948f21ba994e771b'), 'sk_l••••••••771b');
  });
});
