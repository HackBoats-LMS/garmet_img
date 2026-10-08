import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function checkApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
  return key === process.env.SYNC_API_KEY;
}

/**
 * GET /api/v1/products/[code]
 * Lookup product by stockCode OR code1.
 * Also returns generated catalogue images.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { code } = await params;

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { stockCode: code },
          { code1: code },
          { id: code },
        ],
      },
      include: {
        category: { select: { name: true, slug: true } },
        subCategory: { select: { name: true, slug: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ data: product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/products/[code]/stock
 * Website team calls this to update stock quantity.
 * Body: { quantity?: number, adjustment?: number, note?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { code } = await params;
    const body = await req.json();
    const { quantity, adjustment, note } = body;

    const product = await prisma.product.findFirst({
      where: { OR: [{ stockCode: code }, { code1: code }] },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let newQty = product.quantity;
    let qtyChange = 0;

    if (typeof quantity === 'number') {
      qtyChange = quantity - product.quantity;
      newQty = quantity;
    } else if (typeof adjustment === 'number') {
      qtyChange = adjustment;
      newQty = Math.max(0, product.quantity + adjustment);
    } else {
      return NextResponse.json({ error: 'Provide quantity or adjustment' }, { status: 400 });
    }

    const autoStatus =
      newQty === 0 ? 'OUT_OF_STOCK' :
      product.status === 'OUT_OF_STOCK' ? 'ACTIVE' :
      product.status;

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        quantity: newQty,
        status: autoStatus,
        syncedAt: new Date(),
      },
    });

    await prisma.inventoryLog.create({
      data: {
        productId: product.id,
        action: qtyChange < 0 ? 'sale' : 'restock',
        qtyChange,
        qtyAfter: newQty,
        note: note || 'Website stock update',
        source: 'website',
      },
    });

    return NextResponse.json({ data: { id: updated.id, quantity: updated.quantity, status: updated.status } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
