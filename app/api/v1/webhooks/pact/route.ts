import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addOrUpdateSizeStock, deductSizeStock } from '@/lib/size-inventory';

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
      const productCode = item.DESIGN_NUMBER ? String(item.DESIGN_NUMBER) : null;
      const newCodeGenerated = item.NEW_CODE_GENERATED ? String(item.NEW_CODE_GENERATED) : null;

      // Ensure mandatory fields exist
      if (!stockCode || !productCode) {
        console.warn('[PACT Webhook] Item skipped: missing mandatory STOCK_CODE or DESIGN_NUMBER');
        continue;
      }

      // Find the stable product by NEW_CODE_GENERATED (code1) OR DESIGN_NUMBER
      let existingProduct = null;
      if (newCodeGenerated) {
        existingProduct = await prisma.product.findFirst({ where: { code1: newCodeGenerated } });
      }
      if (!existingProduct) {
        existingProduct = await prisma.product.findFirst({ where: { productCode: productCode } });
      }

      // If PACT is sending an offline sale deduction or return
      if (event_type === 'OFFLINE_SALE' || event_type === 'SALES_RETURN' || event_type === 'STOCK_ADJUSTMENT') {
        const qtyChange = parseInt(item.qty_change || '0', 10);
        const itemSize = item.SIZE ? String(item.SIZE).trim() : null;
        
        await prisma.$transaction(async (tx) => {
          const product = existingProduct || await tx.product.findUnique({ where: { stockCode } });
          if (product) {
            let nextSizeInventory = product.sizeInventory as any;
            let nextQuantity = Math.max(0, product.quantity + qtyChange);

            if (itemSize) {
              if (qtyChange < 0) {
                // Sale deduction for this specific size
                const deducted = deductSizeStock(product.sizeInventory, itemSize, Math.abs(qtyChange));
                nextSizeInventory = deducted.sizeInventory;
                nextQuantity = deducted.totalQuantity;
              } else {
                // Return / addition for this specific size
                const added = addOrUpdateSizeStock(product.sizeInventory, itemSize, qtyChange);
                nextSizeInventory = added.sizeInventory;
                nextQuantity = added.totalQuantity;
              }
            }

            await tx.product.update({
              where: { id: product.id },
              data: {
                quantity: nextQuantity,
                sizeInventory: nextSizeInventory,
              }
            });

            await tx.inventoryLog.create({
              data: {
                productId: product.id,
                action: event_type.toLowerCase(),
                qtyChange: qtyChange,
                qtyAfter: nextQuantity,
                note: `PACT sync: ${document_reference}${itemSize ? ` (Size: ${itemSize})` : ''}`,
                source: 'pact_erp'
              }
            });
          }
        });
      } 
      else if (event_type === 'NEW_STOCK' || event_type === 'STOCK_UPDATE') {
        
        const newQty = parseInt(item.current_stock || '1', 10);
        const itemSize = item.SIZE ? String(item.SIZE).trim() : null;

        if (existingProduct) {
          // 1. UPDATE EXISTING STABLE PRODUCT (Add batch stock to its specific size)
          let nextSizeInv: any = existingProduct.sizeInventory;
          let calculatedTotalQty = existingProduct.quantity + newQty;

          if (itemSize) {
            const added = addOrUpdateSizeStock(existingProduct.sizeInventory, itemSize, newQty);
            nextSizeInv = added.sizeInventory;
            calculatedTotalQty = added.totalQuantity;
          }

          // Build a readable list of available sizes for length_Size
          const activeSizes = nextSizeInv && typeof nextSizeInv === 'object'
            ? Object.keys(nextSizeInv).filter(s => (nextSizeInv as any)[s] > 0).join(', ')
            : (existingProduct.length_Size || itemSize);

          const updateData: any = {
            stockCode: stockCode, // The latest batch barcode
            quantity: calculatedTotalQty,
            sizeInventory: nextSizeInv as any,
            length_Size: activeSizes || existingProduct.length_Size,
          };
          
          if (newCodeGenerated) updateData.code1 = newCodeGenerated;
          if (item.RETAIL_PRICE !== undefined) updateData.unitPrice = parseFloat(item.RETAIL_PRICE) || 0;
          if (item.WHOLESALE_PRICE !== undefined) updateData.dealerPrice = parseFloat(item.WHOLESALE_PRICE) || 0;
          if (item.UNIT_PRICE !== undefined) updateData.retailPrice = parseFloat(item.UNIT_PRICE) || 0;
          if (item.PRODUCT_NAME) updateData.productName = item.PRODUCT_NAME;
          
          // Only update text fields if explicitly sent
          if (item.LOCATION) updateData.location = item.LOCATION;
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
                qtyAfter: calculatedTotalQty,
                note: `PACT added batch ${stockCode} to stable design ${productCode}${itemSize ? ` (Size: ${itemSize}, Qty: ${newQty})` : ''}.`,
                source: 'pact_erp'
              }
            });
          });

        } else {
          // 2. CREATE BRAND NEW STABLE PRODUCT
          const initialSizeInventory: Record<string, number> = itemSize ? { [itemSize.toUpperCase()]: newQty } : {};

          const createData = {
            stockCode: stockCode,
            code1: newCodeGenerated || null,
            productName: item.PRODUCT_NAME || item.WHATSAPP_CATALOGUE_TITLE || item.SHOPIFY_TITLE || 'New Garment',
            productCode: productCode,
            length_Size: itemSize || null,
            sizeInventory: Object.keys(initialSizeInventory).length > 0 ? initialSizeInventory : null,
            color: item.COLOUR || null,
            location: item.LOCATION || null,
            unitPrice: parseFloat(item.RETAIL_PRICE) || 0,
            dealerPrice: parseFloat(item.WHOLESALE_PRICE) || 0,
            retailPrice: parseFloat(item.UNIT_PRICE) || 0, 
            productDescription: item.PRODUCT_DESCRIPTION || null,
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
            const product = await tx.product.create({ data: createData as any });

            await tx.inventoryLog.create({
              data: {
                productId: product.id,
                action: 'pact_ingestion',
                qtyChange: newQty,
                qtyAfter: newQty,
                note: `PACT created new stable product: ${document_reference}${itemSize ? ` (Size: ${itemSize})` : ''}`,
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
