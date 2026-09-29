import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

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
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { stockCode: { contains: search, mode: 'insensitive' } },
        { friendlyCode: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
        { clothType: { contains: search, mode: 'insensitive' } },
        { designNumber: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (status) where.status = status;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
          _count: { select: { inventoryLogs: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ products, total, page, limit });
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
      referenceImages, coverImageUrl,
      captions, websiteCopy, websiteProductId,
      // XLSX-mapped fields
      designNumber, size, location, embroideryType, cutStyle,
      border, kurtaLength, pantStyle,
      whatsappRetail, whatsappWholesale,
      instagramCaption, facebookCaption, shopifyTitle, whatsappCatalogueTitle,
      // Custom columns
      customFields,
    } = body;

    if (!stockCode || !title) {
      return NextResponse.json({ error: 'stockCode and title are required' }, { status: 400 });
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
        friendlyCode: finalFriendlyCode || null,
        title,
        description: description || null,
        color: color || null,
        tags: tags || [],
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        clothType: clothType || null,
        price: price ? parseFloat(price) : null,
        mrp: mrp ? parseFloat(mrp) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        quantity: quantity ? parseInt(quantity) : 0,
        status: status || 'ACTIVE',
        referenceImages: referenceImages || null,
        coverImageUrl: coverImageUrl || null,
        captions: captions || null,
        websiteCopy: websiteCopy || null,
        websiteProductId: websiteProductId || null,
        // XLSX fields
        designNumber: designNumber || null,
        size: size || null,
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

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Stock code or friendly code already exists' }, { status: 409 });
    }
    console.error('[Admin Products POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
