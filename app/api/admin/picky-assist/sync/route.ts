import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addPickyProduct, updatePickyProduct, syncPickyProductWithDiff, searchPickyProduct } from '@/lib/picky-assist-push';

export const dynamic = 'force-dynamic';

async function handleSync(productId?: string | null, stockCode?: string | null, action?: string | null) {
  if (!productId && !stockCode) {
    return NextResponse.json({ error: 'productId or stockCode is required' }, { status: 400 });
  }

  // Fetch the product from DB
  const product = await prisma.product.findFirst({
    where: productId ? { id: productId } : { stockCode: stockCode as string },
    include: {
      category: true,
      subCategory: true,
    }
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found in local database' }, { status: 404 });
  }

  const effectiveAction = action || 'sync';

  if (effectiveAction === 'add') {
    const res = await addPickyProduct(product);
    if (res.success && product.id) {
      await prisma.product.update({
        where: { id: product.id },
        data: { syncedAt: new Date() },
      }).catch(err => console.warn('Failed to update syncedAt:', err));
    }
    return NextResponse.json({ 
      success: res.success, 
      actionTaken: 'added',
      message: res.success ? `Added product ${product.stockCode} to Picky Assist` : (res.error || 'Failed to add product'),
      details: res
    }, { status: res.success ? 200 : 502 });
  }

  if (effectiveAction === 'update') {
    const res = await updatePickyProduct(product);
    if (res.success && product.id) {
      await prisma.product.update({
        where: { id: product.id },
        data: { syncedAt: new Date() },
      }).catch(err => console.warn('Failed to update syncedAt:', err));
    }
    return NextResponse.json({ 
      success: res.success, 
      actionTaken: 'updated',
      message: res.success ? `Updated product ${product.stockCode} in Picky Assist` : (res.error || 'Failed to update product'),
      details: res
    }, { status: res.success ? 200 : 502 });
  }

  if (effectiveAction === 'search') {
    const identifier = product.stockCode || product.code1 || product.id;
    const res = await searchPickyProduct(identifier);
    return NextResponse.json({
      success: true,
      exists: res.exists,
      product: res.product,
      raw: res.raw,
      message: res.exists ? `Product ${identifier} exists in Picky Assist` : `Product ${identifier} not found in Picky Assist`
    });
  }

  // Default: 'sync' -> Search -> if not exists: Add -> if exists: Diff and Update
  const syncResult = await syncPickyProductWithDiff(product);
  if (syncResult.success && product.id) {
    await prisma.product.update({
      where: { id: product.id },
      data: { syncedAt: new Date() },
    }).catch(err => console.warn('Failed to update syncedAt:', err));
  }

  return NextResponse.json({
    success: syncResult.success,
    actionTaken: syncResult.action,
    message: syncResult.message,
    diff: syncResult.diff,
    remoteProduct: syncResult.remoteProduct,
  }, { status: syncResult.success ? 200 : 502 });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const productId = searchParams.get('productId');
    const stockCode = searchParams.get('stockCode');

    // Return sync status summary and candidates for bulk sync
    if (action === 'summary' || action === 'candidates') {
      const allProducts = await prisma.product.findMany({
        select: {
          id: true,
          stockCode: true,
          code1: true,
          productName: true,
          quantity: true,
          status: true,
          syncedAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const unsynced = allProducts.filter((p) => !p.syncedAt);
      const modified = allProducts.filter(
        (p) => p.syncedAt && new Date(p.updatedAt).getTime() > new Date(p.syncedAt).getTime() + 1000
      );

      return NextResponse.json({
        success: true,
        total: allProducts.length,
        unsyncedCount: unsynced.length,
        modifiedCount: modified.length,
        products: allProducts,
      });
    }

    return await handleSync(productId, stockCode, action);
  } catch (err: any) {
    console.error('[Picky Assist Sync Error]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { productId, stockCode, action, syncAll, productIds } = body;

    // Bulk Sync All support
    if (syncAll) {
      let whereClause: any = {};
      if (Array.isArray(productIds) && productIds.length > 0) {
        whereClause = { id: { in: productIds } };
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: {
          category: true,
          subCategory: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      let added = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const product of products) {
        try {
          const res = await syncPickyProductWithDiff(product);
          if (res.success) {
            if (res.action === 'added') added++;
            else updated++;

            await prisma.product.update({
              where: { id: product.id },
              data: { syncedAt: new Date() },
            }).catch(() => {});
          } else {
            failed++;
            errors.push(`${product.stockCode}: ${res.message}`);
          }
        } catch (err: any) {
          failed++;
          errors.push(`${product.stockCode}: ${err.message || 'Error'}`);
        }
      }

      return NextResponse.json({
        success: failed === 0,
        total: products.length,
        added,
        updated,
        failed,
        errors: errors.slice(0, 10),
        message: `Synced ${products.length} products to Picky Assist (${added} added, ${updated} updated, ${failed} failed)`,
      });
    }

    return await handleSync(productId, stockCode, action);
  } catch (err: any) {
    console.error('[Picky Assist Sync Error]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

