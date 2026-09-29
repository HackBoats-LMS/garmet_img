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

      // If PACT is sending an offline sale deduction
      if (event_type === 'OFFLINE_SALE' || event_type === 'SALES_RETURN' || event_type === 'STOCK_ADJUSTMENT') {
        const qtyChange = parseInt(item.qty_change || '0', 10);
        
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { stockCode } });
          if (product) {
            await tx.product.update({
              where: { stockCode },
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
        
        // 1. Data strictly for CREATING a brand new product
        const createData = {
          stockCode: newCodeGenerated || stockCode, // Use the new code if provided
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
          quantity: parseInt(item.current_stock || '1', 10)
        };

        // 2. Data strictly for UPDATING an existing product
        // We carefully check if PACT actually sent the data. 
        // If they left it blank (optional), we DO NOT overwrite our existing database with null!
        const updateData: any = {};
        
        if (newCodeGenerated) updateData.stockCode = newCodeGenerated;
        if (item.RETAIL_PRICE !== undefined) updateData.price = parseFloat(item.RETAIL_PRICE) || 0;
        if (item.WHOLESALE_PRICE !== undefined) updateData.wholesalePrice = parseFloat(item.WHOLESALE_PRICE) || 0;
        if (item.UNIT_PRICE !== undefined) updateData.mrp = parseFloat(item.UNIT_PRICE) || 0;
        if (item.current_stock !== undefined) updateData.quantity = parseInt(item.current_stock, 10);
        
        // Only update text fields if PACT explicitly sent a non-empty string
        if (item.LOCATION) updateData.location = item.LOCATION;
        if (item.SIZE) updateData.size = item.SIZE;
        if (item.COLOUR) updateData.color = item.COLOUR;
        
        // UPSERT: Update it if it exists (carefully), Create it if it is brand new
        await prisma.product.upsert({
          where: { stockCode },
          update: updateData,
          create: createData
        });

        // Log the ingestion
        const product = await prisma.product.findUnique({ where: { stockCode } });
        if (product) {
          await prisma.inventoryLog.create({
            data: {
              productId: product.id,
              action: 'pact_ingestion',
              qtyChange: createData.quantity,
              qtyAfter: createData.quantity,
              note: `PACT data imported/updated: ${document_reference || 'Manual Sync'}`,
              source: 'pact_erp'
            }
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
