import * as crypto from 'crypto';

/**
 * Validates that an incoming URL is a safe public web URL, preventing Server-Side Request Forgery (SSRF).
 * Blocks loopback (127.0.0.1, localhost), link-local / cloud metadata (169.254.169.254),
 * and private RFC 1918 networks (10.x, 172.16-31.x, 192.168.x).
 */
export function isSafeExternalUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase().trim();

    // Block loopback & link-local / metadata
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === 'metadata.google.internal' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('169.254.')
    ) {
      return false;
    }

    // Block private RFC 1918 ranges
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    // Block internal docker/service names
    if (!hostname.includes('.')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a Google Photos baseUrl is legitimate and points to Google's CDN.
 */
export function isSafeGooglePhotosUrl(urlStr: string): boolean {
  if (!isSafeExternalUrl(urlStr)) return false;
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase().trim();
    return (
      hostname === 'googleusercontent.com' ||
      hostname.endsWith('.googleusercontent.com') ||
      hostname === 'google.com' ||
      hostname.endsWith('.google.com')
    );
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison that prevents timing attacks and guards against
 * Node.js crypto.timingSafeEqual RangeError when buffer byte lengths differ.
 */
export function safeTimingCompare(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.byteLength !== bufB.byteLength) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Re-export rate limiting utilities for unified security helpers
export { checkRateLimit, getClientIp } from './rate-limit';
