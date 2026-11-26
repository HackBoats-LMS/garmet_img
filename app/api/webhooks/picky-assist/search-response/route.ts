import { NextRequest, NextResponse } from 'next/server';
import { parsePickyAssistWebhookBody } from '@/lib/picky-assist-orders';
import { saveSearchResponse } from '@/lib/picky-assist-search-store';
import { saveRequest, RecordedRequest } from '@/lib/picky-assist-logger';
import { safeTimingCompare, checkRateLimit } from '@/lib/security';
import { getSetting } from '@/lib/settings';

export async function POST(req: NextRequest) {
  return handleSearchCallback(req);
}

export async function GET(req: NextRequest) {
  return handleSearchCallback(req);
}

export async function PUT(req: NextRequest) {
  return handleSearchCallback(req);
}

async function handleSearchCallback(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const id = `sr_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const method = req.method;
  const url = req.nextUrl.pathname + req.nextUrl.search;
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

  // 1. Rate limiting
  const rate = checkRateLimit('webhook:picky-search', ip, { windowMs: 60 * 1000, max: 120 });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  // 2. Token verification: if token is provided, verify it against expectedToken.
  // We do NOT block with 401 if Picky Assist does not send headers/query token,
  // matching the resilient behavior of delete-response.
  const expectedToken = (await getSetting('PICKY_ASSIST_API_TOKEN', process.env.PICKY_ASSIST_API_TOKEN))?.trim();
  if (expectedToken) {
    const authHeader = req.headers.get('authorization') || '';
    const apiKeyHeader = req.headers.get('x-api-key') || '';
    const tokenParam = req.nextUrl.searchParams.get('token') || '';
    const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim() || apiKeyHeader.trim() || tokenParam.trim();

    if (rawToken && !safeTimingCompare(rawToken, expectedToken)) {
      console.warn(`[Picky Assist Search Callback] Invalid token attempt from IP: ${ip}`);
      return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
    }
  }

  // Parse payload (handles JSON, URL-encoded form data, nested JSON)
  const { parsedBody, rawBody, contentType } = await parsePickyAssistWebhookBody(req);

  // Capture headers
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Capture query params
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((val, key) => {
    query[key] = val;
  });

  // Always merge query params (?identifier=...&searchId=...) with body so callback params are preserved
  const effectivePayload = { ...query, ...(parsedBody && typeof parsedBody === 'object' ? parsedBody : {}) };

  // Save to search response store
  const savedSearch = saveSearchResponse(effectivePayload);

  // Also log into global logStore for /admin/picky-test inspection
  try {
    const recorded: RecordedRequest = {
      id,
      timestamp,
      method,
      url,
      ip,
      headers,
      query,
      body: effectivePayload,
      rawBody: rawBody || undefined,
      responseStatus: 200,
      detectedType: 'Picky Assist Search Response Callback',
      mappingResult: {
        success: savedSearch.found,
        actionTaken: savedSearch.found ? 'SIMULATED' : 'PRODUCTS_NOT_FOUND',
        summaryMessage: savedSearch.summary,
        remoteProduct: savedSearch.product,
      },
    };
    saveRequest(recorded);
  } catch (err) {
    console.error('[Search Callback] Failed to log to logStore:', err);
  }

  return NextResponse.json({
    success: true,
    message: 'Search callback received and processed successfully',
    found: savedSearch.found,
    summary: savedSearch.summary,
    product: savedSearch.product,
  });
}
