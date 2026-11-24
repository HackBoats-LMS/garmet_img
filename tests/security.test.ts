import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSafeExternalUrl,
  isSafeGooglePhotosUrl,
  safeTimingCompare,
} from '../lib/security';

describe('Security & SSRF Defense Utilities', () => {
  test('blocks SSRF loopback and link-local metadata IPs', () => {
    // Cloud metadata (AWS, GCP, Azure, OpenStack)
    assert.equal(isSafeExternalUrl('http://169.254.169.254/latest/meta-data'), false);
    assert.equal(isSafeExternalUrl('http://metadata.google.internal/computeMetadata/v1'), false);

    // Loopback
    assert.equal(isSafeExternalUrl('http://127.0.0.1:3000/admin'), false);
    assert.equal(isSafeExternalUrl('http://localhost:5432'), false);
    assert.equal(isSafeExternalUrl('http://0.0.0.0:80'), false);
    assert.equal(isSafeExternalUrl('http://[::1]:8080'), false);

    // Private RFC 1918 subnets
    assert.equal(isSafeExternalUrl('http://10.0.0.5/api'), false);
    assert.equal(isSafeExternalUrl('http://192.168.1.1/setup'), false);
    assert.equal(isSafeExternalUrl('http://172.16.0.1/admin'), false);
    assert.equal(isSafeExternalUrl('http://172.31.255.255/db'), false);

    // Non-HTTP protocols
    assert.equal(isSafeExternalUrl('file:///etc/passwd'), false);
    assert.equal(isSafeExternalUrl('ftp://example.com/file'), false);
    assert.equal(isSafeExternalUrl('gopher://example.com'), false);
  });

  test('allows safe public web and CDN image URLs', () => {
    assert.equal(isSafeExternalUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg'), true);
    assert.equal(isSafeExternalUrl('https://pub-abc123.r2.dev/generated/photo.png'), true);
    assert.equal(isSafeExternalUrl('https://lh3.googleusercontent.com/photos/xyz'), true);
  });

  test('validates Google Photos baseUrl domains strictly', () => {
    assert.equal(isSafeGooglePhotosUrl('https://lh3.googleusercontent.com/a/random_token=w2048'), true);
    assert.equal(isSafeGooglePhotosUrl('https://photos.google.com/album/123'), true);
    assert.equal(isSafeGooglePhotosUrl('https://evil-googleusercontent.com/fake'), false);
    assert.equal(isSafeGooglePhotosUrl('http://169.254.169.254/lh3.googleusercontent.com'), false);
  });

  test('constant-time string comparison protects against timing attacks and length errors', () => {
    const secret = 'prod_webhook_secret_9948271638';
    assert.equal(safeTimingCompare(secret, 'prod_webhook_secret_9948271638'), true);
    assert.equal(safeTimingCompare(secret, 'wrong_secret'), false);
    assert.equal(safeTimingCompare(secret, null), false);
    assert.equal(safeTimingCompare(undefined, secret), false);
    assert.equal(safeTimingCompare('', ''), false);
  });
});
