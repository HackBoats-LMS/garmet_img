import { NextRequest } from 'next/server';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface ClientRecord {
  count: number;
  lastReset: number;
}

const rateLimitStores = new Map<string, Map<string, ClientRecord>>();

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export function checkRateLimit(
  routeKey: string,
  clientId: string,
  options: RateLimitOptions = { windowMs: 60 * 1000, max: 60 }
): { allowed: boolean; remaining: number; resetTime: number } {
  if (!rateLimitStores.has(routeKey)) {
    rateLimitStores.set(routeKey, new Map());
  }
  const store = rateLimitStores.get(routeKey)!;
  const now = Date.now();
  const record = store.get(clientId);

  if (!record || now - record.lastReset > options.windowMs) {
    store.set(clientId, { count: 1, lastReset: now });

    // Clean up stale entries periodically to prevent memory leaks
    if (store.size > 1000) {
      for (const [k, v] of store.entries()) {
        if (now - v.lastReset > options.windowMs) {
          store.delete(k);
        }
      }
    }

    return {
      allowed: true,
      remaining: options.max - 1,
      resetTime: now + options.windowMs,
    };
  }

  if (record.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.lastReset + options.windowMs,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: options.max - record.count,
    resetTime: record.lastReset + options.windowMs,
  };
}
