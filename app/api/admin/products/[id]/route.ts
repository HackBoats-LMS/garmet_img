import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { updatePickyProduct } from '@/lib/picky-assist-push';

// GET /api/admin/products/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        subCategory: true,
        inventoryLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/products/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const {
      stockCode, friendlyCode, title, description,
      color, tags, categoryId, subCategoryId, clothType,
      price, mrp, wholesalePrice, status,
      referenceImages, generatedImages, coverImageUrl, linkedOrderId, aspectRatio,
      captions, websiteCopy, websiteProductId,
      // XLSX-mapped fields
      designNumber, size, location, embroideryType, cutStyle,
      border, kurtaLength, pantStyle,
      whatsappRetail, whatsappWholesale,
      instagramCaption, facebookCaption, shopifyTitle, whatsappCatalogueTitle,
      // Custom columns
      customFields,
      // Quantity
      quantityAdjustment, adjustmentNote, adjustmentSource,
      quantity,
    } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Handle quantity changes with logging
    let newQty = existing.quantity;
    const logsToCreate: any[] = [];

    if (typeof quantity === 'number' && quantity !== existing.quantity) {
      // Direct override (admin set)
      const diff = quantity - existing.quantity;
      newQty = quantity;
      logsToCreate.push({
        productId: id,
        action: 'adjustment',
        qtyChange: diff,
        qtyAfter: newQty,
        note: adjustmentNote || 'Admin quantity adjustment',
        source: adjustmentSource || 'admin',
      });
    } else if (typeof quantityAdjustment === 'number' && quantityAdjustment !== 0) {
      // Relative adjustment (+/-)
      newQty = Math.max(0, existing.quantity + quantityAdjustment);
      logsToCreate.push({
        productId: id,
        action: quantityAdjustment > 0 ? 'restock' : 'adjustment',
        qtyChange: quantityAdjustment,
        qtyAfter: newQty,
        note: adjustmentNote || (quantityAdjustment > 0 ? 'Restock' : 'Adjustment'),
        source: adjustmentSource || 'admin',
      });
    }

    // Auto-status based on qty
    let autoStatus = body.status || existing.status;
    if (newQty === 0 && autoStatus === 'ACTIVE') {
      autoStatus = 'OUT_OF_STOCK';
    } else if (newQty > 0 && autoStatus === 'OUT_OF_STOCK') {
      autoStatus = 'ACTIVE';
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        stockCode: stockCode ?? undefined,
        code1: friendlyCode ?? undefined,
        productName: title ?? undefined,
        productDescription: description ?? undefined,
        color: color ?? undefined,
        tags: tags ?? undefined,
        categoryId: categoryId ?? undefined,
        subCategoryId: subCategoryId ?? undefined,
        clothType: clothType ?? undefined,
        unitPrice: price !== undefined ? parseFloat(price) : undefined,
        retailPrice: mrp !== undefined ? parseFloat(mrp) : undefined,
        dealerPrice: wholesalePrice !== undefined ? parseFloat(wholesalePrice) : undefined,
        quantity: newQty,
        status: autoStatus ?? undefined,
        referenceImages: referenceImages ?? undefined,
        generatedImages: generatedImages ?? undefined,
        coverImageUrl: coverImageUrl ?? undefined,
        linkedOrderId: linkedOrderId ?? undefined,
        aspectRatio: aspectRatio ?? undefined,
        captions: captions ?? undefined,
        websiteCopy: websiteCopy ?? undefined,
        websiteProductId: websiteProductId ?? undefined,
        // XLSX-mapped fields
        productCode: designNumber ?? undefined,
        length_Size: size ?? undefined,
        location: location ?? undefined,
        embroideryType: embroideryType ?? undefined,
        cutStyle: cutStyle ?? undefined,
        border: border ?? undefined,
        kurtaLength: kurtaLength ?? undefined,
        pantStyle: pantStyle ?? undefined,
        whatsappRetail: whatsappRetail ?? undefined,
        whatsappWholesale: whatsappWholesale ?? undefined,
        instagramCaption: instagramCaption ?? undefined,
        facebookCaption: facebookCaption ?? undefined,
        shopifyTitle: shopifyTitle ?? undefined,
        whatsappCatalogueTitle: whatsappCatalogueTitle ?? undefined,
        customFields: customFields ?? undefined,
      },
      include: {
        category: true,
        subCategory: true,
      },
    });

    // Create inventory logs
    if (logsToCreate.length > 0) {
      await prisma.inventoryLog.createMany({ data: logsToCreate });
    }

    updatePickyProduct(updated).catch(console.error);

    return NextResponse.json({ product: updated });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Stock code or friendly code already exists' }, { status: 409 });
    }
    console.error('[Admin Products PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    
    if (existing) {
      await prisma.product.delete({ where: { id } });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
