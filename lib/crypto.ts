import crypto from 'crypto';

/**
 * Derives a consistent 32-byte (256-bit) encryption key.
 * Prefers process.env.APP_ENCRYPTION_KEY, with automatic fallback to
 * hashing process.env.NEXTAUTH_SECRET so it works with zero manual config.
 */
function getMasterKey(): Buffer {
  const customKey = process.env.APP_ENCRYPTION_KEY;
  if (customKey && customKey.trim().length >= 32) {
    return crypto.createHash('sha256').update(customKey.trim()).digest();
  }

  const authSecret = process.env.NEXTAUTH_SECRET || 'couture_ai_master_secret_fallback_key_2026';
  return crypto.createHash('sha256').update(authSecret).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: "enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptValue(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') return '';
  
  const trimmed = plaintext.trim();
  if (!trimmed) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(trimmed, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext created by encryptValue.
 * Returns the plaintext string, or the raw value if not encrypted.
 */
export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue || typeof encryptedValue !== 'string') return '';

  const trimmed = encryptedValue.trim();
  if (!trimmed.startsWith('enc:')) {
    // Value was stored unencrypted or legacy
    return trimmed;
  }

  const parts = trimmed.split(':');
  if (parts.length !== 4) {
    console.warn('[Crypto] Malformed encrypted value format');
    return '';
  }

  const [, ivHex, authTagHex, cipherHex] = parts;

  try {
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err: any) {
    console.error('[Crypto] Decryption failed (invalid key or corrupted tag):', err?.message);
    return '';
  }
}

/**
 * Returns a masked representation of a secret for secure UI display.
 * Example: "sk_live_948f21ba994e771b" -> "sk_••••••••••••771b"
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  const s = secret.trim();
  if (s.length <= 6) return '••••••';
  if (s.length <= 12) return `${s.slice(0, 2)}••••${s.slice(-2)}`;
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
}
