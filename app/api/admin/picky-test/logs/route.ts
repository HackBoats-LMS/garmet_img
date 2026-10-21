import { NextRequest, NextResponse } from 'next/server';
import { getRecordedRequests, clearRecordedRequests, saveRequest, updateRecordedRequest, RecordedRequest } from '../logStore';
import { processPickyAssistOrder } from '@/lib/picky-assist-orders';
import prisma from '@/lib/prisma';

// GET: Return all recorded test webhook requests
export async function GET() {
  const requests = getRecordedRequests();
  return NextResponse.json({ success: true, count: requests.length, requests });
}

// DELETE: Clear all recorded test webhook requests
export async function DELETE() {
  clearRecordedRequests();
  return NextResponse.json({ success: true, message: 'All logs cleared' });
}

// POST: Actions for testing, replaying, or simulating incoming orders
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate_sample';

    // 1. Replay an existing recorded request against DB
    if (action === 'replay') {
      const { requestId, dryRun = false } = body;
      const allRequests = getRecordedRequests();
      const targetReq = allRequests.find((r) => r.id === requestId);

      if (!targetReq) {
        return NextResponse.json({ error: `Request ${requestId} not found` }, { status: 404 });
      }

      const result = await processPickyAssistOrder(targetReq.body, { dryRun });
      updateRecordedRequest(requestId, {
        mappingResult: result,
      });

      return NextResponse.json({
        success: true,
        message: dryRun ? 'Payload simulated successfully' : 'Order replayed and DB inventory updated!',
        mappingResult: result,
      });
    }

    // 2. Test map an arbitrary payload without persisting changes
    if (action === 'test_map') {
      const { payload } = body;
      if (!payload) {
        return NextResponse.json({ error: 'Payload object is required for test_map' }, { status: 400 });
      }
      const result = await processPickyAssistOrder(payload, { dryRun: true });
      return NextResponse.json({
        success: true,
        mappingResult: result,
      });
    }

    // 3. Simulate a realistic incoming order with an actual product from the DB
    if (action === 'simulate_order') {
      const { productId, stockCode, quantity = 1, size, format = 'whatsapp_catalog', dryRun = false } = body;

      let targetProduct: any = null;
      if (productId) {
        targetProduct = await prisma.product.findUnique({ where: { id: productId } });
      } else if (stockCode) {
        targetProduct = await prisma.product.findFirst({
          where: { OR: [{ stockCode }, { code1: stockCode }] },
        });
      } else {
        // Pick the first active product with positive quantity
        targetProduct = await prisma.product.findFirst({
          where: { quantity: { gt: 0 } },
          orderBy: { updatedAt: 'desc' },
        });
      }

      if (!targetProduct) {
        return NextResponse.json({ error: 'No product available in database to simulate order' }, { status: 400 });
      }

      const orderRef = `PA-WA-${Math.floor(100000 + Math.random() * 900000)}`;
      const customerPhone = '+919876543210';
      const customerName = 'Simulated Shopper';

      let simulatedPayload: any = {};
      const chosenStockCode = targetProduct.stockCode || targetProduct.code1 || 'TEST-ITEM';

      if (format === 'whatsapp_catalog') {
        simulatedPayload = {
          event: 'order_created',
          order_id: orderRef,
          customer: {
            name: customerName,
            phone: customerPhone,
            email: 'shopper@whatsapp.example',
          },
          items: [
            {
              product_retailer_id: chosenStockCode,
              title: targetProduct.productName,
              quantity: Number(quantity) || 1,
              size: size || undefined,
              item_price: targetProduct.retailPrice || targetProduct.unitPrice || 999,
            },
          ],
          total_amount: (targetProduct.retailPrice || targetProduct.unitPrice || 999) * (Number(quantity) || 1),
          payment_status: 'paid',
          notes: 'Customer purchased via WhatsApp Catalog Cart checkout flow',
        };
      } else if (format === 'form_encoded') {
        simulatedPayload = {
          order_reference: orderRef,
          phone: customerPhone,
          name: customerName,
          stock_code: chosenStockCode,
          quantity: Number(quantity) || 1,
          size: size || undefined,
          notes: 'Webhook action from Picky Assist bot automation',
        };
      } else {
        // Direct single item sale event
        simulatedPayload = {
          order_id: orderRef,
          stock_code: chosenStockCode,
          quantity_ordered: Number(quantity) || 1,
          size: size || undefined,
          customer_phone: customerPhone,
        };
      }

      // Process the order
      const processResult = await processPickyAssistOrder(simulatedPayload, { dryRun });

      const sampleReq: RecordedRequest = {
        id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        method: 'POST',
        url: '/api/webhooks/picky-assist',
        ip: '127.0.0.1 (Simulator)',
        headers: {
          'content-type': format === 'form_encoded' ? 'application/x-www-form-urlencoded' : 'application/json',
          'user-agent': 'PickyAssist-WhatsApp-Gateway/2.0',
          'x-forwarded-for': '127.0.0.1',
        },
        query: {},
        body: simulatedPayload,
        responseStatus: processResult.success ? 200 : 400,
        mappingResult: processResult,
      };

      saveRequest(sampleReq);

      return NextResponse.json({
        success: processResult.success,
        message: dryRun
          ? `Simulated order ${orderRef} without modifying DB`
          : `Order ${orderRef} placed! Successfully deducted ${quantity} unit(s) from '${targetProduct.productName}' in database.`,
        request: sampleReq,
        mappingResult: processResult,
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[Picky Test Logs API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
