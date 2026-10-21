import { NextRequest, NextResponse } from 'next/server';
import { parsePickyAssistWebhookBody, processPickyAssistOrder } from '@/lib/picky-assist-orders';
import { saveRequest, RecordedRequest } from '../logStore';

export async function POST(req: NextRequest) {
  return handleIncoming(req);
}

export async function GET(req: NextRequest) {
  return handleIncoming(req);
}

export async function PUT(req: NextRequest) {
  return handleIncoming(req);
}

export async function PATCH(req: NextRequest) {
  return handleIncoming(req);
}

async function handleIncoming(req: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const method = req.method;
    const url = req.nextUrl.pathname + req.nextUrl.search;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

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

    // Check if test simulation requested without DB write: ?dryRun=true
    const isDryRun = req.nextUrl.searchParams.get('dryRun') === 'true' || req.nextUrl.searchParams.get('simulate') === 'true';

    // Parse incoming payload
    const { parsedBody, rawBody, contentType } = await parsePickyAssistWebhookBody(req);
    const effectivePayload = method === 'GET' ? { ...query, ...parsedBody } : parsedBody;

    // Process order & update DB quantity
    let processResult: any = null;
    let responseStatus = 200;

    try {
      processResult = await processPickyAssistOrder(effectivePayload, { dryRun: isDryRun });
      responseStatus = processResult.success ? 200 : (processResult.actionTaken === 'PRODUCTS_NOT_FOUND' ? 404 : 200);
    } catch (err: any) {
      console.error('[Picky Test Webhook] Error executing order processing:', err);
      processResult = {
        success: false,
        actionTaken: 'ERROR',
        summaryMessage: `Order processing error: ${err.message}`,
        itemsProcessed: [],
        fieldMappings: [],
      };
      responseStatus = 500;
    }

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
      responseStatus,
      mappingResult: processResult,
    };

    saveRequest(recorded);

    return NextResponse.json(
      {
        success: processResult.success,
        actionTaken: processResult.actionTaken,
        message: processResult.summaryMessage || 'Picky Assist webhook captured successfully',
        receivedAt: timestamp,
        requestId: id,
        method,
        order_reference: processResult.orderMeta?.orderId,
        orderMeta: processResult.orderMeta,
        results: processResult.itemsProcessed,
        fieldMappings: processResult.fieldMappings,
      },
      { status: responseStatus }
    );
  } catch (error: any) {
    console.error('[Picky Test Webhook Receiver] Fatal Error:', error);
    return NextResponse.json(
      { error: 'Internal Error processing test webhook', details: error.message },
      { status: 500 }
    );
  }
}
