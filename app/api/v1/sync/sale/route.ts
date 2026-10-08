import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function checkApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
  return key === process.env.SYNC_API_KEY;
}

/**
 * POST /api/v1/sync/sale
 * Called by the website when a product is sold.
 *
 * Body:
 * {
 *   stockCode: "987654321",       // required (or code1)
 *   code1: "saree-03-red", // alternative lookup
 *   qtySold: 1,
 *   orderId: "WEB-12345",         // website's order ID for tracking
 *   note: "Customer purchase via website"
 * }
 */
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized — provide x-api-key header' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { stockCode, code1, qtySold, orderId, note } = body;

    if (!stockCode && !code1) {
      return NextResponse.json({ error: 'stockCode or code1 required' }, { status: 400 });
    }
    if (!qtySold || qtySold < 1) {
      return NextResponse.json({ error: 'qtySold must be >= 1' }, { status: 400 });
    }

    // Find product
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          ...(stockCode ? [{ stockCode }] : []),
          ...(code1 ? [{ code1 }] : []),
        ],
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check stock
    const available = product.quantity - product.reservedQty;
    if (available < qtySold) {
      return NextResponse.json(
        {
          error: 'Insufficient stock',
          available,
          requested: qtySold,
        },
        { status: 409 }
      );
    }

    const newQty = Math.max(0, product.quantity - qtySold);
    const newSold = product.soldQty + qtySold;
    const autoStatus = newQty === 0 ? 'OUT_OF_STOCK' : product.status;

    // Update product
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        quantity: newQty,
        soldQty: newSold,
        status: autoStatus,
        syncedAt: new Date(),
      },
    });

    // Log the sale
    await prisma.inventoryLog.create({
      data: {
        productId: product.id,
        action: 'sale',
        qtyChange: -qtySold,
        qtyAfter: newQty,
        note: note || `Website sale — Order ${orderId || 'unknown'}`,
        source: 'website',
      },
    });

    return NextResponse.json({
      success: true,
      product: {
        id: updated.id,
        stockCode: updated.stockCode,
        code1: updated.code1,
        productName: updated.productName,
        quantityBefore: product.quantity,
        quantityAfter: newQty,
        totalSold: newSold,
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error('[Sync Sale Webhook]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
