import { NextRequest, NextResponse } from 'next/server';
import { parsePickyAssistWebhookBody, processPickyAssistOrder } from '@/lib/picky-assist-orders';
import { saveRequest, RecordedRequest } from '@/app/api/admin/picky-test/logStore';

export async function POST(req: NextRequest) {
  return handleWebhook(req);
}

export async function GET(req: NextRequest) {
  return handleWebhook(req);
}

export async function PUT(req: NextRequest) {
  return handleWebhook(req);
}

async function handleWebhook(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const method = req.method;
  const url = req.nextUrl.pathname + req.nextUrl.search;
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

  // Security: Verify token only if configured in environment
  const expectedToken = process.env.PICKY_ASSIST_API_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers.get('authorization') || '';
    const apiKeyHeader = req.headers.get('x-api-key') || '';
    const tokenParam = req.nextUrl.searchParams.get('token') || '';
    const isValid =
      authHeader === `Bearer ${expectedToken}` ||
      authHeader === expectedToken ||
      apiKeyHeader === expectedToken ||
      tokenParam === expectedToken;

    if (!isValid) {
      console.warn(`[Picky Assist Webhook] Unauthorized attempt from IP: ${ip}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Parse body (handles JSON, URLSearchParams, form-urlencoded, raw strings)
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

  // Combine query and parsedBody if GET or empty body
  const effectivePayload = method === 'GET' ? { ...query, ...parsedBody } : parsedBody;

  let processResult: any = null;
  let status = 200;

  try {
    // Process order & update database quantity
    processResult = await processPickyAssistOrder(effectivePayload);
    status = processResult.success ? 200 : (processResult.actionTaken === 'PRODUCTS_NOT_FOUND' ? 404 : 200);
  } catch (err: any) {
    console.error('[Picky Assist Webhook] Processing error:', err);
    processResult = {
      success: false,
      actionTaken: 'ERROR',
      summaryMessage: `Error: ${err.message}`,
      itemsProcessed: [],
    };
    status = 500;
  }

  // Record request for inspection in /admin/picky-test
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
      responseStatus: status,
      mappingResult: processResult,
    };
    saveRequest(recorded);
  } catch (err) {
    console.error('[Picky Assist Webhook] Failed to save to logStore:', err);
  }

  return NextResponse.json(
    {
      success: processResult.success,
      actionTaken: processResult.actionTaken,
      message: processResult.summaryMessage,
      order_reference: processResult.orderMeta?.orderId,
      results: processResult.itemsProcessed,
      fieldMappings: processResult.fieldMappings,
    },
    { status }
  );
}
