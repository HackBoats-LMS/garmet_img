import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { addPickyProduct } from '@/lib/picky-assist-push';

function generateFriendlyCode(categorySlug: string, color: string | null | undefined, seq: number) {
  const parts = [categorySlug || 'item'];
  if (color) parts.push(color.toLowerCase().replace(/\s+/g, '-'));
  parts.push(String(seq).padStart(2, '0'));
  return parts.join('-');
}

// GET /api/admin/products
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const subCategoryId = searchParams.get('subCategoryId') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const cursorId = searchParams.get('cursor'); // CUID cursor (time-ordered)
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { stockCode: { contains: search, mode: 'insensitive' } },
        { code1: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
        { clothType: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    if (categoryId === 'uncategorized' || categoryId === 'null') {
      where.categoryId = null;
    } else if (categoryId) {
      where.categoryId = categoryId;
    }
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (status) where.status = status;

    // Use cursor pagination if cursor provided, otherwise fall back to offset
    const useCursor = !!cursorId;
    const take = limit + 1;

    let products;
    if (useCursor) {
      products = await prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
          _count: { select: { inventoryLogs: true } },
        },
        orderBy: { id: 'desc' },
        cursor: { id: cursorId },
        take,
      });
    } else {
      products = await prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
          _count: { select: { inventoryLogs: true } },
        },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      });
    }
    const total = await prisma.product.count({ where });

    // Determine if there's a next page
    const hasNextPage = products.length > limit;
    const items = hasNextPage ? products.slice(0, limit) : products;

    // Generate next cursor from last item
    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      nextCursor = items[items.length - 1].id;
    }

    const formattedProducts = items.map((p) => {
      const genObj = (p.generatedImages as Record<string, any>) || {};
      const sortedGenList = Object.entries(genObj)
        .sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0))
        .map(([, img]: any) => img.imageUrl)
        .filter(Boolean);

      let cover = p.coverImageUrl;
      if ((!cover || cover.includes('tempfile')) && sortedGenList.length > 0) {
        cover = sortedGenList[0];
      }

      return {
        ...p,
        title: p.productName,
        friendlyCode: p.code1,
        price: p.retailPrice ?? p.unitPrice,
        mrp: p.retailPrice,
        wholesalePrice: p.dealerPrice,
        coverImageUrl: cover,
      };
    });

    const uncategorizedCount = await prisma.product.count({ where: { categoryId: null } });

    return NextResponse.json({ 
      products: formattedProducts, 
      total, 
      uncategorizedCount,
      nextCursor,
      hasNextPage,
      limit,
      ...(!useCursor && { page }),
    });
  } catch (error: any) {
    console.error('[Admin Products GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/products
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      stockCode, friendlyCode, title, description,
      color, tags, categoryId, subCategoryId, clothType,
      price, mrp, wholesalePrice, quantity, status,
      referenceImages, generatedImages, coverImageUrl,
      captions, websiteCopy, websiteProductId,
      // XLSX-mapped fields
      designNumber, size, location, embroideryType, cutStyle,
      border, kurtaLength, pantStyle,
      whatsappRetail, whatsappWholesale,
      instagramCaption, facebookCaption, shopifyTitle, whatsappCatalogueTitle,
      sizeInventory,
      // Custom columns
      customFields,
    } = body;

    if (!stockCode || !title) {
      return NextResponse.json({ error: 'stockCode and productName are required' }, { status: 400 });
    }

    let finalFriendlyCode = friendlyCode || null;
    if (!finalFriendlyCode && categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      const count = await prisma.product.count({ where: { categoryId } });
      finalFriendlyCode = generateFriendlyCode(cat?.slug || 'item', color, count + 1);
    }

    const product = await prisma.product.create({
      data: {
        stockCode: stockCode.trim(),
        code1: finalFriendlyCode || null,
        productName: title,
        productDescription: description || null,
        color: color || null,
        tags: tags || [],
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        clothType: clothType || null,
        unitPrice: price ? parseFloat(price) : null,
        retailPrice: mrp ? parseFloat(mrp) : null,
        dealerPrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        quantity: quantity ? parseInt(quantity) : 0,
        status: status || 'ACTIVE',
        referenceImages: referenceImages || null,
        generatedImages: generatedImages || null,
        coverImageUrl: coverImageUrl || null,
        captions: captions || null,
        websiteCopy: websiteCopy || null,
        websiteProductId: websiteProductId || null,
        // XLSX fields
        productCode: designNumber || null,
        length_Size: size || null,
        sizeInventory: sizeInventory || null,
        location: location || null,
        embroideryType: embroideryType || null,
        cutStyle: cutStyle || null,
        border: border || null,
        kurtaLength: kurtaLength || null,
        pantStyle: pantStyle || null,
        whatsappRetail: whatsappRetail || null,
        whatsappWholesale: whatsappWholesale || null,
        instagramCaption: instagramCaption || null,
        facebookCaption: facebookCaption || null,
        shopifyTitle: shopifyTitle || null,
        whatsappCatalogueTitle: whatsappCatalogueTitle || null,
        customFields: customFields || null,
      },
      include: { category: true, subCategory: true },
    });

    if (quantity && parseInt(quantity) > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          action: 'restock',
          qtyChange: parseInt(quantity),
          qtyAfter: parseInt(quantity),
          note: 'Initial stock on product creation',
          source: 'admin',
        },
      });
    }

    addPickyProduct(product).catch(console.error);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Stock code or friendly code already exists' }, { status: 409 });
    }
    console.error('[Admin Products POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
