import { NextRequest, NextResponse } from 'next/server';
import { addPickyProduct, updatePickyProduct, searchPickyProduct, syncPickyProductWithDiff } from '@/lib/picky-assist-push';

export async function POST(req: NextRequest) {
  try {
    const { action, payload, identifier } = await req.json();

    const envUrls = {
      searchUrl: process.env.PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL || null,
      addUrl: process.env.PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL || null,
      updateUrl: process.env.PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL || null,
    };

    if (action === 'get_env') {
      return NextResponse.json({
        success: true,
        envUrls,
      });
    }

    if (!action || !['search', 'add', 'update', 'sync'].includes(action)) {
      return NextResponse.json({ error: 'Valid action (search, add, update, sync) is required.' }, { status: 400 });
    }

    if (action === 'search') {
      const searchTarget = identifier || payload?.stockCode || payload?.stock_code || payload?.code1 || payload?.id;
      if (!searchTarget) {
        return NextResponse.json({ error: 'Search identifier (stockCode, code1, etc.) is required.' }, { status: 400 });
      }
      const searchRes = await searchPickyProduct(searchTarget);
      return NextResponse.json({
        success: true,
        action: 'search',
        identifier: searchTarget,
        webhookUrlUsed: envUrls.searchUrl,
        result: searchRes,
      });
    }

    if (action === 'sync') {
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Valid JSON payload object is required for sync.' }, { status: 400 });
      }
      const syncRes = await syncPickyProductWithDiff(payload);
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

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Valid JSON payload object is required.' }, { status: 400 });
    }

    if (action === 'add') {
      const addRes = await addPickyProduct(payload);
      return NextResponse.json({
        success: addRes.success,
        action: 'add',
        webhookUrlUsed: envUrls.addUrl,
        response: addRes,
      });
    } else if (action === 'update') {
      const updateRes = await updatePickyProduct(payload);
      return NextResponse.json({
        success: updateRes.success,
        action: 'update',
        webhookUrlUsed: envUrls.updateUrl,
        response: updateRes,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Picky Test API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

