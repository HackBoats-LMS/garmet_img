import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
    const search = (searchParams.get('search') || '').trim();
    const categoryId = searchParams.get('categoryId') || '';
    const subCategoryId = searchParams.get('subCategoryId') || '';
    const categorized = searchParams.get('categorized') || '';
    const status = searchParams.get('status') || '';
    const stockHealth = searchParams.get('stockHealth') || '';
    const syncStatus = searchParams.get('syncStatus') || '';
    const missingImage = searchParams.get('missingImage') || '';
    const missingPrice = searchParams.get('missingPrice') || '';
    const missingAi = searchParams.get('missingAi') || '';
    const clothType = (searchParams.get('clothType') || '').trim();
    const color = (searchParams.get('color') || '').trim();
    const sort = searchParams.get('sort') || 'newest';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const cursorId = searchParams.get('cursor'); // CUID cursor (time-ordered)
    const skip = (page - 1) * limit;

    const andConditions: Prisma.ProductWhereInput[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { stockCode: { contains: search, mode: 'insensitive' } },
          { code1: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
          { color: { contains: search, mode: 'insensitive' } },
          { clothType: { contains: search, mode: 'insensitive' } },
          { productCode: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ],
      });
    }

    if (categorized === 'true') {
      andConditions.push({ categoryId: { not: null } });
    } else if (categorized === 'false') {
      andConditions.push({ categoryId: null });
    }

    if (categoryId === 'uncategorized' || categoryId === 'null') {
      andConditions.push({ categoryId: null });
    } else if (categoryId) {
      andConditions.push({ categoryId });
    }

    if (subCategoryId) {
      andConditions.push({ subCategoryId });
    }

    if (stockHealth === 'low' || status === 'LOW_STOCK') {
      andConditions.push({ status: 'ACTIVE', quantity: { gt: 0, lte: 3 } });
    } else if (status) {
      andConditions.push({ status: status as any });
    }

    if (syncStatus === 'unsynced') {
      andConditions.push({ syncedAt: null });
    } else if (syncStatus === 'modified') {
      const modifiedRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE "syncedAt" IS NOT NULL AND "updatedAt" > "syncedAt" + INTERVAL '1 second'
      `;
      andConditions.push({ id: { in: modifiedRows.map((r) => r.id) } });
    } else if (syncStatus === 'synced') {
      const syncedRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE "syncedAt" IS NOT NULL AND "updatedAt" <= "syncedAt" + INTERVAL '1 second'
      `;
      andConditions.push({ id: { in: syncedRows.map((r) => r.id) } });
    }

    if (missingImage === 'true') {
      andConditions.push({ coverImageUrl: null, generatedImages: { equals: Prisma.DbNull } });
    } else if (missingImage === 'false') {
      andConditions.push({
        OR: [
          { coverImageUrl: { not: null } },
          { generatedImages: { not: Prisma.DbNull } },
        ],
      });
    }

    if (missingPrice === 'true') {
      andConditions.push({ retailPrice: null, unitPrice: null });
    } else if (missingPrice === 'false') {
      andConditions.push({
        OR: [{ retailPrice: { not: null } }, { unitPrice: { not: null } }],
      });
    }

    if (missingAi === 'true') {
      andConditions.push({ generatedImages: { equals: Prisma.DbNull } });
    } else if (missingAi === 'false') {
      andConditions.push({ generatedImages: { not: Prisma.DbNull } });
    }

    if (clothType) {
      andConditions.push({ clothType: { equals: clothType, mode: 'insensitive' } });
    }

    if (color) {
      andConditions.push({ color: { equals: color, mode: 'insensitive' } });
    }

    const where: Prisma.ProductWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
    switch (sort) {
      case 'updated':
        orderBy = { updatedAt: 'desc' };
        break;
      case 'qty_asc':
        orderBy = [{ quantity: 'asc' }, { id: 'desc' }];
        break;
      case 'qty_desc':
        orderBy = [{ quantity: 'desc' }, { id: 'desc' }];
        break;
      case 'price_asc':
        orderBy = [{ retailPrice: { sort: 'asc', nulls: 'last' } }, { unitPrice: { sort: 'asc', nulls: 'last' } }];
        break;
      case 'price_desc':
        orderBy = [{ retailPrice: { sort: 'desc', nulls: 'last' } }, { unitPrice: { sort: 'desc', nulls: 'last' } }];
        break;
      case 'code_asc':
        orderBy = { stockCode: 'asc' };
        break;
      default:
        orderBy = { id: 'desc' };
        break;
    }

    // Use cursor pagination if cursor provided, otherwise fall back to offset
    const useCursor = !!cursorId;
    const take = limit + 1;

    const productSelect = {
      id: true,
      stockCode: true,
      code1: true,
      productName: true,
      color: true,
      clothType: true,
      retailPrice: true,
      unitPrice: true,
      dealerPrice: true,
      quantity: true,
      length_Size: true,
      sizeInventory: true,
      reservedQty: true,
      soldQty: true,
      status: true,
      coverImageUrl: true,
      generatedImages: true,
      syncedAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
      subCategory: { select: { id: true, name: true, slug: true } },
    } satisfies Prisma.ProductSelect;

    const [
      products,
      total,
      totalAll,
      inStockCount,
      outOfStockCount,
      lowStockCount,
      categorizedCount,
      uncategorizedCount,
      unsyncedCount,
      modifiedCountRows,
      clothTypesRaw,
      colorsRaw,
    ] = await Promise.all([
      useCursor
        ? prisma.product.findMany({
            where,
            select: productSelect,
            orderBy,
            cursor: { id: cursorId },
            take,
          })
        : prisma.product.findMany({
            where,
            select: productSelect,
            orderBy,
            skip,
            take: limit,
          }),
      prisma.product.count({ where }),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'OUT_OF_STOCK' } }),
      prisma.product.count({ where: { status: 'ACTIVE', quantity: { gt: 0, lte: 3 } } }),
      prisma.product.count({ where: { categoryId: { not: null } } }),
      prisma.product.count({ where: { categoryId: null } }),
      prisma.product.count({ where: { syncedAt: null } }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "Product"
        WHERE "syncedAt" IS NOT NULL AND "updatedAt" > "syncedAt" + INTERVAL '1 second'
      `,
      prisma.product.findMany({
        where: { clothType: { not: null } },
        distinct: ['clothType'],
        select: { clothType: true },
        orderBy: { clothType: 'asc' },
      }),
      prisma.product.findMany({
        where: { color: { not: null } },
        distinct: ['color'],
        select: { color: true },
        orderBy: { color: 'asc' },
      }),
    ]);

    const modifiedCount = modifiedCountRows[0]?.count ?? 0;
    const syncedCount = Math.max(0, totalAll - unsyncedCount - modifiedCount);

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

      const { generatedImages: _gen, ...rest } = p;

      return {
        ...rest,
        hasAi: sortedGenList.length > 0,
        title: p.productName,
        friendlyCode: p.code1,
        price: p.retailPrice ?? p.unitPrice,
        mrp: p.retailPrice,
        wholesalePrice: p.dealerPrice,
        coverImageUrl: cover,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      total,
      uncategorizedCount,
      stats: {
        total: totalAll,
        inStock: inStockCount,
        outOfStock: outOfStockCount,
        lowStock: lowStockCount,
        categorized: categorizedCount,
        uncategorized: uncategorizedCount,
        synced: syncedCount,
        modified: modifiedCount,
        unsynced: unsyncedCount,
      },
      facets: {
        clothTypes: clothTypesRaw.map((c) => c.clothType).filter(Boolean) as string[],
        colors: colorsRaw.map((c) => c.color).filter(Boolean) as string[],
      },
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

    addPickyProduct(product)
      .then(async (res) => {
        if (res?.success) {
          await prisma.product
            .update({
              where: { id: product.id },
              data: { syncedAt: new Date() },
            })
            .catch(() => {});
        }
      })
      .catch(console.error);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Stock code or friendly code already exists' }, { status: 409 });
    }
    console.error('[Admin Products POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
