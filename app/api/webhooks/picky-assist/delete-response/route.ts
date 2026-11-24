import { NextRequest, NextResponse } from 'next/server';
import { parsePickyAssistWebhookBody } from '@/lib/picky-assist-orders';
import { saveDeleteResponse } from '@/lib/picky-assist-delete-store';
import { saveRequest, RecordedRequest } from '@/lib/picky-assist-logger';

export async function POST(req: NextRequest) {
  return handleDeleteCallback(req);
}

export async function GET(req: NextRequest) {
  return handleDeleteCallback(req);
}

export async function PUT(req: NextRequest) {
  return handleDeleteCallback(req);
}

async function handleDeleteCallback(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const id = `del_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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

  // Merge query parameters and body so callback query params (e.g. ?identifier=XYZ) are preserved
  const effectivePayload = { ...query, ...parsedBody };

  // Save to delete response store
  const savedDelete = saveDeleteResponse(effectivePayload);

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
      detectedType: 'Picky Assist Delete Response Callback',
      mappingResult: {
        success: savedDelete.deleted,
        actionTaken: savedDelete.deleted ? 'DELETED' : 'DELETE_FAILED',
        summaryMessage: savedDelete.summary,
      },
    };
    saveRequest(recorded);
  } catch (err) {
    console.error('[Delete Callback] Failed to log to logStore:', err);
  }

  return NextResponse.json({
    success: true,
    message: 'Delete callback received and processed successfully',
    deleted: savedDelete.deleted,
    summary: savedDelete.summary,
    identifier: savedDelete.identifier,
  });
}
