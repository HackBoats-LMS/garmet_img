import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { syncOrderToPactERP } from '@/lib/pact-sync';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;

    // 1. Shopify Security Signature Verification
    if (shopifySecret && hmacHeader) {
      const generatedHash = crypto
        .createHmac('sha256', shopifySecret)
        .update(rawBody, 'utf8')
        .digest('base64');

      // Prevent Timing Attacks
      if (!crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader))) {
        console.warn('[Shopify Webhook] Invalid HMAC Signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // Reject if secrets are missing in production
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Shopify Order Payload
    const order = JSON.parse(rawBody);

    // Ensure it's a paid order (Optional depending on which webhook topic you subscribe to)
    if (order.financial_status !== 'paid') {
      return NextResponse.json({ status: 'ignored', message: 'Order not paid yet' }, { status: 200 });
    }

    const lineItems = order.line_items || [];
    const customer = order.customer || {};
    const shippingAddress = order.shipping_address || {};

    // 3. Process each item bought on Shopify
    for (const item of lineItems) {
      const stockCode = item.sku; // We map Shopify SKU directly to our stockCode
      const quantityOrdered = parseInt(item.quantity, 10);

      if (!stockCode) continue;

      // Deduct from Next.js Cloud DB
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { stockCode } });

        if (product && product.quantity >= quantityOrdered) {
          // Update DB Inventory
          await tx.product.update({
            where: { stockCode },
            data: { 
              quantity: product.quantity - quantityOrdered,
              reservedQty: product.reservedQty + quantityOrdered 
            }
          });

          // Log the sale
          await tx.inventoryLog.create({
            data: {
              productId: product.id,
              action: 'shopify_sale',
              qtyChange: -quantityOrdered,
              qtyAfter: product.quantity - quantityOrdered,
              note: `Shopify Order #${order.order_number}`,
              source: 'shopify'
            }
          });
        }
      });
    }

    // 4. Send the Order to PACT ERP to deduct local warehouse stock
    const syncItems = lineItems.map((item: any) => ({
      sku: item.sku,
      quantity: parseInt(item.quantity, 10),
      price: parseFloat(item.price || '0')
    }));

    syncOrderToPactERP({
      source_channel: 'Shopify',
      order_reference: `SHP-${order.order_number}`,
      order_date: order.created_at || new Date().toISOString(),
      customer_name: customer.first_name ? `${customer.first_name} ${customer.last_name || ''}` : '',
      customer_phone: customer.phone || shippingAddress.phone || '',
      items: syncItems,
      total_price: parseFloat(order.total_price || '0')
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('[Shopify Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
