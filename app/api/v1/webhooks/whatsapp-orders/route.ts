import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { syncOrderToPactERP } from '@/lib/pact-sync';
import { deductSizeStock, findSizeByStockCode } from '@/lib/size-inventory';

// In-memory store for rate limiting (For production, use Redis/Upstash)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 50; // max requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }
  if (now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting Security
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    // Read raw body for signature verification
    const rawBody = await request.text();
    
    // 2. Webhook Setup Verification (GET equivalent in POST or explicit URL params)
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode && token) {
      if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'WTKN_rgjdass_couture_catalog_2024')) {
        return new NextResponse(challenge, { status: 200 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Payload Security Verification (Flexible: API Key OR Signature)
    const authHeader = request.headers.get('authorization');
    const signature = request.headers.get('x-hub-signature-256');
    const appSecret = process.env.WHATSAPP_APP_SECRET; 
    const staticApiToken = process.env.WHATSAPP_API_TOKEN || 'test-token';

    let isAuthorized = false;

    // Method A (Easier): Static API Key via Bearer Token
    if (authHeader === `Bearer ${staticApiToken}`) {
      isAuthorized = true;
    } 
    // Method B (Meta Standard): HMAC SHA-256 Signature
    else if (appSecret && signature) {
      const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
      if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.warn(`[Security] Unauthorized webhook attempt from IP: ${ip}`);
      return NextResponse.json({ error: 'Unauthorized. Please provide a valid Bearer Token or Signature.' }, { status: 401 });
    }

    // 4. Parse Payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (payload.object === 'whatsapp_business_account' && payload.entry) {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.value?.messages) {
            for (const message of change.value.messages) {
              
              // Handle Cart Order Message
              if (message.order?.product_items) {
                const customerPhone = message.from;
                const items = message.order.product_items;
                
                for (const item of items) {
                  const stockCode = item.product_retailer_id;
                  const quantityOrdered = parseInt(item.quantity, 10);

                  // Edge Case: Invalid quantity
                  if (isNaN(quantityOrdered) || quantityOrdered <= 0) {
                     console.warn(`[Edge Case] Invalid quantity ordered: ${item.quantity} for item ${stockCode}`);
                     continue; 
                  }

                  // 5. Transactional DB Updates
                  await prisma.$transaction(async (tx) => {
                    // Handle size-specific SKU if passed as "SKU:SIZE" or item.size
                    let requestedSize: string | null = (item.size || (item as any).variant_id) ? String(item.size || (item as any).variant_id).trim() : null;
                    let targetIdentifier = stockCode;
                    if (!requestedSize && stockCode.includes(':')) {
                      const parts = stockCode.split(':');
                      targetIdentifier = parts[0];
                      requestedSize = parts[1];
                    }

                    // Try to find by any of the stable IDs exported to the catalog
                    let product = await tx.product.findFirst({ 
                      where: { 
                        OR: [
                          { code1: targetIdentifier },
                          { productCode: targetIdentifier },
                          { stockCode: targetIdentifier }
                        ]
                      } 
                    });

                    // If not found directly, check if targetIdentifier matches a variant barcode inside sizeInventory
                    if (!product) {
                      const possibleMatches = await tx.product.findMany({
                        where: {
                          sizeInventory: {
                            not: null as any
                          }
                        },
                        take: 100
                      });
                      for (const p of possibleMatches) {
                        const foundSize = findSizeByStockCode(p.sizeInventory, targetIdentifier);
                        if (foundSize) {
                          product = p;
                          if (!requestedSize) {
                            requestedSize = foundSize.size;
                          }
                          break;
                        }
                      }
                    }
                    
                    // Edge Case: Product Not Found
                    if (!product) {
                      console.error(`[Edge Case] Webhook requested non-existent stable ID: ${stockCode}`);
                      return;
                    }

                    // Edge Case: Insufficient Stock
                    if (product.quantity < quantityOrdered) {
                      console.warn(`[Edge Case] Stock underflow attempted for ${stockCode}. Ordered: ${quantityOrdered}, Available: ${product.quantity}`);
                      return;
                    }

                    // Edge Case: Size-specific inventory check & deduction
                    let updatedSizeInventory: any = product.sizeInventory;
                    let newTotalQty = product.quantity - quantityOrdered;

                    if (requestedSize) {
                      const deductResult = deductSizeStock(product.sizeInventory, requestedSize, quantityOrdered);
                      if (!deductResult.success) {
                        console.warn(`[Edge Case] Size stock shortage: ${deductResult.error}`);
                        return;
                      }
                      updatedSizeInventory = deductResult.sizeInventory;
                      newTotalQty = deductResult.totalQuantity;
                    }

                    // Proceed with stock deduction
                    await tx.product.update({
                      where: { id: product.id },
                      data: {
                          quantity: newTotalQty,
                          sizeInventory: (updatedSizeInventory as any) ?? undefined,
                          reservedQty: product.reservedQty + quantityOrdered 
                      }
                    });

                    await tx.inventoryLog.create({
                      data: {
                        productId: product.id,
                        action: 'whatsapp_sale',
                        qtyChange: -quantityOrdered,
                        qtyAfter: newTotalQty,
                        note: `WhatsApp Order. Customer: ${customerPhone}${requestedSize ? ` (Size: ${requestedSize})` : ''}`,
                        source: 'whatsapp'
                      }
                    });
                  });
                  
                  // We need the product info to send to PACT, but the transaction closure means we need to query it or just use what we know.
                  // Actually we can just fire it off:
                  syncOrderToPactERP({
                    source_channel: 'WhatsApp',
                    order_reference: `WA-${Date.now()}`,
                    order_date: new Date().toISOString(),
                    customer_name: 'WhatsApp Customer',
                    customer_phone: customerPhone,
                    items: [{
                      sku: stockCode,
                      quantity: quantityOrdered,
                      price: parseFloat(item.item_price || '0')
                    }],
                    total_price: parseFloat(item.item_price || '0') * quantityOrdered
                  });
                }
              }

            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Error processing WhatsApp Webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
