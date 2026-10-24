import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  addPickyProduct,
  updatePickyProduct,
  searchPickyProduct,
  syncPickyProductWithDiff,
  formatProductPayload,
} from '@/lib/picky-assist-push';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload, identifier, productId, changedFields } = body;

    const envUrls = {
      searchUrl: process.env.PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL || null,
      addUrl: process.env.PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL || null,
      updateUrl: process.env.PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL || null,
      searchCallbackUrl: process.env.PICKY_ASSIST_SEARCH_CALLBACK_URL || null,
    };

    if (action === 'get_env') {
      return NextResponse.json({
        success: true,
        envUrls,
      });
    }

    // Resolve target product if productId is provided
    let dbProduct: any = null;
    if (productId) {
      dbProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
          subCategory: true,
        },
      });
    }

    // 1. Preview Payload (Inspection without firing network call)
    if (action === 'preview_payload') {
      const targetProduct = dbProduct || payload;
      if (!targetProduct) {
        return NextResponse.json({ error: 'Product or payload is required for preview.' }, { status: 400 });
      }

      const mainPayload = formatProductPayload(targetProduct);
      const rawSizeInv = targetProduct.sizeInventory || targetProduct.size_inventory;
      const variantPayloads: Record<string, any> = {};

      if (rawSizeInv && typeof rawSizeInv === 'object') {
        for (const sz of Object.keys(rawSizeInv)) {
          if (sz.trim().toUpperCase() !== 'FREE') {
            variantPayloads[sz] = formatProductPayload(targetProduct, sz);
          }
        }
      }

      return NextResponse.json({
        success: true,
        action: 'preview_payload',
        mainPayload,
        variantPayloads,
        hasMultipleVariants: Object.keys(variantPayloads).length > 1,
      });
    }

    if (!action || !['search', 'add', 'update', 'sync'].includes(action)) {
      return NextResponse.json({ error: 'Valid action (search, add, update, sync, preview_payload) is required.' }, { status: 400 });
    }

    // 2. Search Action
    if (action === 'search') {
      const searchTarget =
        identifier ||
        (dbProduct && (dbProduct.stockCode || dbProduct.code1 || dbProduct.id)) ||
        payload?.stockCode ||
        payload?.stock_code ||
        payload?.code1 ||
        payload?.id;

      if (!searchTarget) {
        return NextResponse.json({ error: 'Search identifier (barcode, stockCode, code1, etc.) is required.' }, { status: 400 });
      }

      const searchRes = await searchPickyProduct(searchTarget);
      return NextResponse.json({
        success: true,
        action: 'search',
        identifier: searchTarget,
        exists: searchRes.exists,
        product: searchRes.product || null,
        raw: searchRes.raw,
        webhookUrlUsed: envUrls.searchUrl,
      });
    }

    // Target object for add / update / sync
    const effectiveTarget = dbProduct || payload;
    if (!effectiveTarget || typeof effectiveTarget !== 'object') {
      return NextResponse.json({ error: 'Valid product selection or JSON payload is required.' }, { status: 400 });
    }

    // 3. Smart Sync Action
    if (action === 'sync') {
      const syncRes = await syncPickyProductWithDiff(effectiveTarget);
      if (syncRes.success && dbProduct?.id) {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { syncedAt: new Date() },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: syncRes.success,
        action: 'sync',
        actionTaken: syncRes.action,
        message: syncRes.message,
        diff: syncRes.diff,
        remoteProduct: syncRes.remoteProduct,
        envUrls,
      });
    }

    // 4. Direct Add Action
    if (action === 'add') {
      const addRes = await addPickyProduct(effectiveTarget);
      if (addRes.success && dbProduct?.id) {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { syncedAt: new Date() },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: addRes.success,
        action: 'add',
        webhookUrlUsed: envUrls.addUrl,
        response: addRes,
        variantsPushed: addRes.variantsPushed,
      });
    }

    // 5. Direct Update Action
    if (action === 'update') {
      const updateRes = await updatePickyProduct(effectiveTarget, changedFields);
      if (updateRes.success && dbProduct?.id) {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { syncedAt: new Date() },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: updateRes.success,
        action: 'update',
        webhookUrlUsed: envUrls.updateUrl,
        response: updateRes,
        variantsUpdated: updateRes.variantsUpdated,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Picky Test API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
