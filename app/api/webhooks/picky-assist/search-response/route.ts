import { NextRequest, NextResponse } from 'next/server';
import { parsePickyAssistWebhookBody } from '@/lib/picky-assist-orders';
import { saveSearchResponse } from '@/lib/picky-assist-search-store';
import { saveRequest, RecordedRequest } from '@/app/api/admin/picky-test/logStore';

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

  const effectivePayload = method === 'GET' ? { ...query, ...parsedBody } : parsedBody;

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
