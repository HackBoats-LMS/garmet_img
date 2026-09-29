import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // 1. Security Check (Bearer Token that PACT sends to us)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.PACT_WEBHOOK_SECRET || 'pact-secret-token';
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn('[PACT Webhook] Unauthorized attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Incoming PACT Payload
    const payload = await request.json();
    const { event_type, document_reference, items } = payload;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload: missing items array' }, { status: 400 });
    }

    // 3. Process Each Item from PACT
    for (const item of items) {
      const stockCode = item.STOCK_CODE ? String(item.STOCK_CODE) : null;
      const designNumber = item.DESIGN_NUMBER ? String(item.DESIGN_NUMBER) : null;
      const newCodeGenerated = item.NEW_CODE_GENERATED ? String(item.NEW_CODE_GENERATED) : null;

      // Ensure mandatory fields exist
      if (!stockCode || !designNumber) {
        console.warn('[PACT Webhook] Item skipped: missing mandatory STOCK_CODE or DESIGN_NUMBER');
        continue;
      }

      // Find the stable product by NEW_CODE_GENERATED (friendlyCode) OR DESIGN_NUMBER
      let existingProduct = null;
      if (newCodeGenerated) {
        existingProduct = await prisma.product.findFirst({ where: { friendlyCode: newCodeGenerated } });
      }
      if (!existingProduct) {
        existingProduct = await prisma.product.findFirst({ where: { designNumber: designNumber } });
      }

      // If PACT is sending an offline sale deduction
      if (event_type === 'OFFLINE_SALE' || event_type === 'SALES_RETURN' || event_type === 'STOCK_ADJUSTMENT') {
        const qtyChange = parseInt(item.qty_change || '0', 10);
        
        await prisma.$transaction(async (tx) => {
          const product = existingProduct || await tx.product.findUnique({ where: { stockCode } });
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { quantity: product.quantity + qtyChange }
            });

            await tx.inventoryLog.create({
              data: {
                productId: product.id,
                action: event_type.toLowerCase(),
                qtyChange: qtyChange,
                qtyAfter: product.quantity + qtyChange,
                note: `PACT sync: ${document_reference}`,
                source: 'pact_erp'
              }
            });
          }
        });
      } 
      else if (event_type === 'NEW_STOCK' || event_type === 'STOCK_UPDATE') {
        
        const newQty = parseInt(item.current_stock || '1', 10);

        if (existingProduct) {
          // 1. UPDATE EXISTING STABLE PRODUCT (Add batch stock to it, update latest barcode)
          const updateData: any = {
            stockCode: stockCode, // The latest batch barcode
            quantity: existingProduct.quantity + newQty, // Add new batch to existing quantity!
          };
          
          if (newCodeGenerated) updateData.friendlyCode = newCodeGenerated;
          if (item.RETAIL_PRICE !== undefined) updateData.price = parseFloat(item.RETAIL_PRICE) || 0;
          if (item.WHOLESALE_PRICE !== undefined) updateData.wholesalePrice = parseFloat(item.WHOLESALE_PRICE) || 0;
          if (item.UNIT_PRICE !== undefined) updateData.mrp = parseFloat(item.UNIT_PRICE) || 0;
          
          // Only update text fields if explicitly sent
          if (item.LOCATION) updateData.location = item.LOCATION;
          if (item.SIZE) updateData.size = item.SIZE;
          if (item.COLOUR) updateData.color = item.COLOUR;
          
          await prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: updateData
            });

            await tx.inventoryLog.create({
              data: {
                productId: existingProduct.id,
                action: 'pact_ingestion',
                qtyChange: newQty,
                qtyAfter: existingProduct.quantity + newQty,
                note: `PACT added batch ${stockCode} to stable design ${designNumber}.`,
                source: 'pact_erp'
              }
            });
          });

        } else {
          // 2. CREATE BRAND NEW STABLE PRODUCT
          const createData = {
            stockCode: stockCode,
            friendlyCode: newCodeGenerated || null,
            title: item.WHATSAPP_CATALOGUE_TITLE || item.SHOPIFY_TITLE || 'New Garment',
            designNumber: designNumber,
            size: item.SIZE || null,
            color: item.COLOUR || null,
            location: item.LOCATION || null,
            price: parseFloat(item.RETAIL_PRICE) || 0,
            wholesalePrice: parseFloat(item.WHOLESALE_PRICE) || 0,
            mrp: parseFloat(item.UNIT_PRICE) || 0, 
            description: item.PRODUCT_DESCRIPTION || null,
            clothType: item.FABRIC || null,
            embroideryType: item.EMBROIDERY_TYPE || null,
            cutStyle: item.CUT_STYLE || null,
            border: item.BORDER || null,
            kurtaLength: item.KURTA_LENGTH || null,
            pantStyle: item.PANT_STYLE || null,
            whatsappRetail: item.WHATSAPP_RETAIL || null,
            whatsappWholesale: item.WHATSAPP_WHOLESALE || null,
            instagramCaption: item.INSTAGRAM_CAPTION || null,
            facebookCaption: item.FACEBOOK_CAPTION || null,
            whatsappCatalogueTitle: item.WHATSAPP_CATALOGUE_TITLE || null,
            quantity: newQty
          };

          await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({ data: createData });

            await tx.inventoryLog.create({
              data: {
                productId: product.id,
                action: 'pact_ingestion',
                qtyChange: newQty,
                qtyAfter: newQty,
                note: `PACT created new stable product: ${document_reference}`,
                source: 'pact_erp'
              }
            });
          });
        }
      }
    }

    return NextResponse.json({ status: 'success', message: 'PACT Data synced to Cloud DB successfully.' }, { status: 200 });

  } catch (error) {
    console.error('[PACT Webhook] Error processing payload:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
