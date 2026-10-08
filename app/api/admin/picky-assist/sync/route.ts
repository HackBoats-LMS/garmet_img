import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addPickyProduct, updatePickyProduct } from '@/lib/picky-assist-push';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const productId = searchParams.get('productId');
    const stockCode = searchParams.get('stockCode');

    if (!action || !['add', 'update'].includes(action)) {
      return NextResponse.json({ error: 'Valid action required (add, update)' }, { status: 400 });
    }

    if (!productId && !stockCode) {
      return NextResponse.json({ error: 'productId or stockCode is required' }, { status: 400 });
    }

    // Fetch the product
    const product = await prisma.product.findFirst({
      where: productId ? { id: productId } : { stockCode: stockCode as string },
      include: {
        category: true,
        subCategory: true,
      }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (action === 'add') {
      await addPickyProduct(product);
    } else if (action === 'update') {
      await updatePickyProduct(product);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Triggered ${action} for product ${product.stockCode}`
    });

  } catch (err: any) {
    console.error('[Picky Assist Sync Error]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
