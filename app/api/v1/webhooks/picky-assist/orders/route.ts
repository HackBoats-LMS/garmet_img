import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncOrderToPactERP } from '@/lib/pact-sync';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/webhooks/picky-assist/orders
//
// Picky Assist workflow triggers this endpoint when a customer places
// an order via WhatsApp (through Picky Assist's bot/catalog flow).
//
// Auth: Bearer token — PICKY_ASSIST_API_TOKEN in .env.local
//
// Expected payload shape (Picky Assist sends this to us):
// {
//   "order_reference": "PA-20241001-001",   // Picky Assist order ID
//   "order_date":      "2024-10-01T10:30:00Z",
//   "customer": {
//     "name":    "Priya Sharma",
//     "phone":   "+919876543210",
//     "email":   "priya@example.com"        // optional
//   },
//   "items": [
//     {
//       "stock_code": "RGJ-001",            // our stable product ID
//       "title":      "Linen Everyday Saree",
//       "quantity":   1,
//       "unit_price": 1299
//     }
//   ],
//   "total_amount": 1299,
//   "payment_status": "paid" | "pending",
//   "notes": "Customer requested green packaging"
// }
// ─────────────────────────────────────────────────────────────────────────────

// ── In-memory rate limiter ────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) { rateLimitMap.set(ip, { count: 1, lastReset: now }); return true; }
  if (now - record.lastReset > RATE_LIMIT_WINDOW_MS) { rateLimitMap.set(ip, { count: 1, lastReset: now }); return true; }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // 1. Rate Limiting
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  // 2. Auth — Bearer token
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.PICKY_ASSIST_API_TOKEN;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    console.warn(`[Picky Assist Orders] Unauthorized attempt from IP: ${ip}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Parse Payload
  let payload: {
    order_reference?: string;
    order_date?: string;
    customer?: { name?: string; phone?: string; email?: string };
    items?: Array<{ stock_code: string; title?: string; quantity: number; unit_price: number }>;
    total_amount?: number;
    payment_status?: string;
    notes?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { order_reference, order_date, customer, items, total_amount, payment_status, notes } = payload;

  // 4. Validate required fields
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Missing required field: items[]' }, { status: 400 });
  }

  const orderRef = order_reference || `PA-${Date.now()}`;
  const customerPhone = customer?.phone || 'unknown';
  const customerName  = customer?.name  || 'Picky Assist Customer';

  const results: Array<{ stock_code: string; status: string; reason?: string }> = [];

  // 5. Process each ordered item
  for (const item of items) {
    const stockCode = item.stock_code ? String(item.stock_code).trim() : null;
    const qty = parseInt(String(item.quantity), 10);

    if (!stockCode) {
      results.push({ stock_code: '(missing)', status: 'skipped', reason: 'No stock_code provided' });
      continue;
    }
    if (isNaN(qty) || qty <= 0) {
      results.push({ stock_code: stockCode, status: 'skipped', reason: `Invalid quantity: ${item.quantity}` });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Find by any of our stable identifiers
        const product = await tx.product.findFirst({
          where: {
            OR: [
              { stockCode },
              { friendlyCode: stockCode },
              { designNumber: stockCode },
            ],
          },
        });

        if (!product) {
          results.push({ stock_code: stockCode, status: 'error', reason: 'Product not found in database' });
          return;
        }

        if (product.quantity < qty) {
          results.push({
            stock_code: stockCode,
            status: 'error',
            reason: `Insufficient stock. Available: ${product.quantity}, Requested: ${qty}`,
          });
          console.warn(`[Picky Assist Orders] Stock underflow for ${stockCode}. Have: ${product.quantity}, Need: ${qty}`);
          return;
        }

        // Deduct stock + increment reserved
        await tx.product.update({
          where: { id: product.id },
          data: {
            quantity:    product.quantity - qty,
            reservedQty: product.reservedQty + qty,
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: product.id,
            action:    'picky_assist_sale',
            qtyChange: -qty,
            qtyAfter:  product.quantity - qty,
            note:      `Picky Assist Order ${orderRef}. Customer: ${customerPhone}. ${notes || ''}`.trim(),
            source:    'picky_assist',
          },
        });

        results.push({ stock_code: stockCode, status: 'success' });
      });
    } catch (err: any) {
      console.error(`[Picky Assist Orders] DB error for ${stockCode}:`, err);
      results.push({ stock_code: stockCode, status: 'error', reason: 'Database error' });
    }
  }

  // 6. Forward to PACT ERP for warehouse deduction
  const successItems = results
    .filter((r) => r.status === 'success')
    .map((r) => {
      const matchedItem = items.find((i) => i.stock_code === r.stock_code)!;
      return {
        sku:      matchedItem.stock_code,
        quantity: parseInt(String(matchedItem.quantity), 10),
        price:    parseFloat(String(matchedItem.unit_price)) || 0,
      };
    });

  if (successItems.length > 0) {
    // Fire-and-forget — don't block the webhook response
    syncOrderToPactERP({
      source_channel: 'WhatsApp',
      order_reference: `PA-${orderRef}`,
      order_date:      order_date || new Date().toISOString(),
      customer_name:   customerName,
      customer_phone:  customerPhone,
      items:           successItems,
      total_price:     parseFloat(String(total_amount)) || successItems.reduce((s, i) => s + i.price * i.quantity, 0),
    });
  }

  // 7. Respond to Picky Assist
  const hasErrors = results.some((r) => r.status === 'error');
  const allFailed = results.every((r) => r.status !== 'success');

  console.log(`[Picky Assist Orders] ✅ Order ${orderRef} processed. Results:`, results);

  return NextResponse.json(
    {
      status:          allFailed ? 'failed' : hasErrors ? 'partial' : 'success',
      order_reference: orderRef,
      results,
    },
    { status: allFailed ? 422 : 200 }
  );
}
