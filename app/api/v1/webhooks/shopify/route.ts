import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

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

    // 4. Send the Order to PACT ERP (To deduct offline central stock and generate Invoice)
    // We run this asynchronously so we can return a 200 to Shopify immediately
    syncOrderToPactERP(order, lineItems, customer, shippingAddress).catch((err) => {
      console.error('[PACT Sync Error] Failed to send Shopify order to PACT:', err);
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('[Shopify Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Helper function to send the Shopify Sale to PACT ERP's API
 */
async function syncOrderToPactERP(order: any, lineItems: any[], customer: any, shippingAddress: any) {
  const pactApiUrl = process.env.PACT_API_URL || 'https://api.pact-erp.com/v1/sales/invoice';
  const pactApiToken = process.env.PACT_API_TOKEN;

  if (!pactApiToken) {
    console.warn('PACT_API_TOKEN is missing, skipping PACT sync.');
    return;
  }

  // Build the payload as per the specifications we gave to the PACT team
  const pactPayload = {
    source_channel: 'Shopify',
    order_reference: `SHOPIFY-${order.order_number}`,
    order_date: order.created_at,
    payment_status: 'Paid',
    payment_method: order.gateway || 'Online',
    customer_details: {
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      phone: customer.phone || shippingAddress.phone || '',
      email: customer.email || '',
      billing_state: order.billing_address?.province || '',
      shipping_state: shippingAddress.province || '',
      gst_treatment: 'Consumer', // Defaulting to Consumer
      reverse_charge: false
    },
    line_items: lineItems.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      unit_rate: parseFloat(item.price),
      discount_amount: parseFloat(item.total_discount || '0'),
      tax_percentage: 5 // Default for garments, or calculate based on Shopify tax lines
    })),
    shipping_charges: parseFloat(order.total_shipping_price_set?.shop_money?.amount || '0'),
    total_invoice_value: parseFloat(order.total_price)
  };

  // Push to PACT
  const response = await fetch(pactApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pactApiToken}`
    },
    body: JSON.stringify(pactPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PACT API responded with ${response.status}: ${errorText}`);
  }

  console.log(`[PACT Sync] Successfully pushed Shopify Order #${order.order_number} to PACT.`);
}
