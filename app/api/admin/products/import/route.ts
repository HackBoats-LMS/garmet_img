import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { parseSheetSmart, mapSpreadsheetRow, MappedProduct } from '@/lib/spreadsheet-mapper';
import { addOrUpdateSizeStock, consolidateSpreadsheetRows, normalizeSizeInventory, sumSizeInventory } from '@/lib/size-inventory';

// POST /api/admin/products/import
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let items: MappedProduct[] = [];
    let verifyOnly = false;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      verifyOnly = body.verifyOnly === true;
      const rawList = Array.isArray(body) ? body : (body.products || body.rows || []);
      // If products were already mapped on the client PC:
      items = rawList.map((r: any) => (r.stockCode && typeof r.quantity === 'number') ? r : mapSpreadsheetRow(r));
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let chosenSheet: XLSX.WorkSheet | null = null;
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet && sheet['!ref']) {
          chosenSheet = sheet;
          break;
        }
      }

      if (!chosenSheet) {
        return NextResponse.json({ error: 'No worksheet with data found in spreadsheet' }, { status: 400 });
      }

      const rawRows = parseSheetSmart(chosenSheet);
      items = rawRows.map(mapSpreadsheetRow);
    }

    // Consolidate rows sharing same Code1 / Product with different sizes & quantities
    const consolidatedItems = consolidateSpreadsheetRows(items);

    // Filter valid items
    const validItems: MappedProduct[] = [];
    let skipped = 0;

    for (const item of consolidatedItems) {
      if (!item.stockCode || item.stockCode === '0' || item.stockCode === '-') {
        skipped++;
      } else {
        validItems.push(item);
      }
    }

    if (validItems.length === 0 && skipped === 0) {
      return NextResponse.json({ error: 'No data rows found in the request' }, { status: 400 });
    }

    // Extract identifiers for verification
    const ids = validItems.map(i => i.id).filter(Boolean) as string[];
    const stockCodes = validItems.map(i => i.stockCode);
    const code1s = validItems.map(i => i.code1).filter(Boolean) as string[];

    // ── MODE 1: VERIFY ONLY (Dry-run / existence pre-check without DB writes) ──
    if (verifyOnly) {
      const existingProducts = await prisma.product.findMany({
        where: {
          OR: [
            ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
            ...(stockCodes.length > 0 ? [{ stockCode: { in: stockCodes } }] : []),
            ...(code1s.length > 0 ? [{ code1: { in: code1s } }] : [])
          ]
        },
        select: { id: true, stockCode: true, code1: true }
      });

      return NextResponse.json({
        success: true,
        verified: true,
        total: validItems.length,
        existingCount: existingProducts.length,
        newCount: Math.max(0, validItems.length - existingProducts.length),
        existing: existingProducts,
      });
    }

    // ── MODE 2: LOW-LOAD BATCH WRITE VIA BULK PRE-FETCHING & CREATE-MANY ──
    // 1. Fetch all existing products matching this batch in 1 single DB query
    const existingProducts = await prisma.product.findMany({
      where: {
        OR: [
          ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
          { stockCode: { in: stockCodes } },
          ...(code1s.length > 0 ? [{ code1: { in: code1s } }] : [])
        ]
      },
      select: { id: true, stockCode: true, code1: true, designGroupId: true, quantity: true, sizeInventory: true, length_Size: true }
    });

    const existingById = new Map<string, typeof existingProducts[0]>();
    const existingByStock = new Map<string, typeof existingProducts[0]>();
    const existingByCode1 = new Map<string, typeof existingProducts[0]>();
    for (const p of existingProducts) {
      if (p.id) existingById.set(p.id, p);
      if (p.stockCode) existingByStock.set(p.stockCode, p);
      if (p.code1) existingByCode1.set(p.code1, p);
    }

    // 2. Fetch all existing design groups in 1 single DB query
    const designNumbers = Array.from(new Set(validItems.map(i => i.productCode).filter(Boolean))) as string[];
    const existingGroups = designNumbers.length > 0
      ? await prisma.productDesignGroup.findMany({
          where: { designNumber: { in: designNumbers } },
          select: { id: true, designNumber: true }
        })
      : [];
    const groupByDesignNum = new Map<string, string>(existingGroups.map(g => [g.designNumber, g.id]));

    // Pre-create any missing design groups in bulk
    for (const item of validItems) {
      if (item.productCode && !groupByDesignNum.has(item.productCode)) {
        try {
          const newGroup = await prisma.productDesignGroup.create({
            data: {
              designNumber: item.productCode,
              title: item.productName || `Design ${item.productCode}`,
              description: item.productDescription,
              color: item.color,
              clothType: item.clothType,
              tags: [],
            },
            select: { id: true }
          });
          groupByDesignNum.set(item.productCode, newGroup.id);
        } catch {
          const found = await prisma.productDesignGroup.findUnique({ where: { designNumber: item.productCode } });
          if (found) groupByDesignNum.set(item.productCode, found.id);
        }
      }
    }

    // 3. Separate items into toCreate (bulk insert) and toUpdate (only modified records)
    const toCreate: any[] = [];
    const toUpdate: { existingId: string; data: any; stockCode: string }[] = [];
    const seenStockInBatch = new Set<string>();

    for (const item of validItems) {
      const stockCode = item.stockCode;
      if (seenStockInBatch.has(stockCode)) continue;
      seenStockInBatch.add(stockCode);

      const designGroupId = item.productCode ? groupByDesignNum.get(item.productCode) || null : null;
      const existing = (item.id ? existingById.get(item.id) : null) ||
                       existingByStock.get(stockCode) ||
                       (item.code1 ? existingByCode1.get(item.code1) : null);

      const itemSizeInventory = item.sizeInventory && typeof item.sizeInventory === 'object' ? item.sizeInventory : null;
      const itemSize = item.length_Size ? String(item.length_Size).trim() : null;
      let finalSizeInventory: any = itemSizeInventory;
      let finalQuantity = item.quantity;
      let finalLengthSize = item.length_Size;

      if (existing) {
        // Sync or merge incoming sizes into existing product's sizeInventory
        const existingInv = normalizeSizeInventory(existing.sizeInventory);
        if (itemSizeInventory) {
          const merged: Record<string, any> = { ...existingInv };
          for (const [sKey, sVal] of Object.entries(itemSizeInventory)) {
            const incomingQty = typeof sVal === 'number' ? sVal : (sVal as any)?.quantity || 0;
            const incomingStockCode = typeof sVal === 'object' ? (sVal as any)?.stockCode : null;
            const currentItem = merged[sKey] || { quantity: 0, stockCode: null };
            // Set quantity to incoming sheet quantity (or keep current if incoming is 0), and map stockCode
            merged[sKey] = {
              quantity: incomingQty > 0 ? incomingQty : (currentItem.quantity || 0),
              stockCode: incomingStockCode || currentItem.stockCode || null,
            };
          }
          finalSizeInventory = merged;
          finalQuantity = sumSizeInventory(merged);
          finalLengthSize = Object.keys(merged).filter(k => (merged[k]?.quantity ?? 0) > 0).join(', ') || item.length_Size;
        } else if (itemSize && itemSize !== '-') {
          const added = addOrUpdateSizeStock(existing.sizeInventory, itemSize, item.quantity, item.stockCode);
          finalSizeInventory = added.sizeInventory;
          finalQuantity = added.totalQuantity;
          const activeSizes = Object.keys(finalSizeInventory).filter(s => (finalSizeInventory[s]?.quantity ?? 0) > 0).join(', ');
          finalLengthSize = activeSizes || existing.length_Size || itemSize;
        } else {
          finalSizeInventory = existing.sizeInventory;
          finalQuantity = item.quantity;
        }
      } else {
        if (!finalSizeInventory && itemSize && itemSize !== '-') {
          finalSizeInventory = {
            [itemSize.toUpperCase()]: {
              quantity: item.quantity,
              stockCode: item.stockCode || null,
            }
          };
        }
      }

      const productPayload = {
        productName: item.productName || `Product ${stockCode}`,
        productDescription: item.productDescription,
        color: item.color,
        clothType: item.clothType,
        unitPrice: item.unitPrice,
        retailPrice: item.retailPrice,
        dealerPrice: item.dealerPrice,
        code1: item.code1,
        productCode: item.productCode,
        length_Size: finalLengthSize,
        sizeInventory: finalSizeInventory,
        location: item.location,
        embroideryType: item.embroideryType,
        cutStyle: item.cutStyle,
        border: item.border,
        kurtaLength: item.kurtaLength,
        pantStyle: item.pantStyle,
        whatsappRetail: item.whatsappRetail,
        whatsappWholesale: item.whatsappWholesale,
        instagramCaption: item.instagramCaption,
        facebookCaption: item.facebookCaption,
        shopifyTitle: item.shopifyTitle,
        whatsappCatalogueTitle: item.whatsappCatalogueTitle,
        quantity: finalQuantity,
        designGroupId,
      };

      if (existing) {
        toUpdate.push({ existingId: existing.id, data: productPayload, stockCode });
      } else {
        toCreate.push({
          ...productPayload,
          stockCode,
          tags: [],
        });
      }
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // 4. Ultra-fast bulk insert for all new products in ONE single SQL command via createMany
    if (toCreate.length > 0) {
      try {
        const createResult = await prisma.product.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        created = createResult.count;
      } catch (err: any) {
        // Fallback to individual creates if needed
        for (const item of toCreate) {
          try {
            await prisma.product.create({ data: item });
            created++;
          } catch (e: any) {
            errors.push(`Create ${item.stockCode}: ${e.message}`);
          }
        }
      }
    }

    // 5. Update only the existing records
    if (toUpdate.length > 0) {
      for (const item of toUpdate) {
        try {
          await prisma.product.update({
            where: { id: item.existingId },
            data: item.data,
          });
          updated++;
        } catch (err: any) {
          errors.push(`Update ${item.stockCode}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      errors,
      message: `Import complete — ${created} created, ${updated} updated, ${skipped} skipped`,
    });
  } catch (error: any) {
    console.error('[Products Import]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
