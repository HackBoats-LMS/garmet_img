import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Auth: header-based API key check (x-api-key or Authorization Bearer)
function checkApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(key && process.env.SYNC_API_KEY && key === process.env.SYNC_API_KEY);
}

/**
 * GET /api/v1/products
 * Public REST API for WhatsApp bot and website team.
 * Secured with x-api-key header.
 *
 * Query params:
 *   ?search=      full-text search
 *   ?category=    category slug e.g. "saree"
 *   ?subCategory= sub-category slug e.g. "silk"
 *   ?status=      ACTIVE | OUT_OF_STOCK | ARCHIVED
 *   ?limit=       default 50
 *   ?page=        default 1
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized — provide x-api-key header' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') || '';
    const categorySlug = searchParams.get('category') || '';
    const subCategorySlug = searchParams.get('subCategory') || '';
    const status = searchParams.get('status') || 'ACTIVE';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status !== 'ALL') where.status = status;

    if (search) {
      where.OR = [
        { stockCode: { contains: search, mode: 'insensitive' } },
        { code1: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (subCategorySlug) {
      where.subCategory = { slug: subCategorySlug };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          stockCode: true,
          code1: true,
          productName: true,
          productDescription: true,
          color: true,
          clothType: true,
          unitPrice: true,
          retailPrice: true,
          quantity: true,
          reservedQty: true,
          soldQty: true,
          status: true,
          coverImageUrl: true,
          generatedImages: true,
          referenceImages: true,
          tags: true,
          category: { select: { name: true, slug: true } },
          subCategory: { select: { name: true, slug: true } },
          websiteCopy: true,
          captions: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const formattedProducts = products.map((p) => {
      const genObj = (p.generatedImages as Record<string, any>) || {};
      const sortedGenEntries = Object.entries(genObj)
        .sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0));
      
      const sortedGenList = sortedGenEntries
        .map(([, img]: any) => img.imageUrl)
        .filter(Boolean);

      // Auto-fallback cover image if missing or tempfile
      let cover = p.coverImageUrl;
      if ((!cover || cover.includes('tempfile')) && sortedGenList.length > 0) {
        cover = sortedGenList[0];
      }

      // Ordered gallery images array: cover first, then remaining photos in exact order
      const images: string[] = [];
      if (cover) images.push(cover);
      for (const imgUrl of sortedGenList) {
        if (!images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }

      return {
        ...p,
        coverImageUrl: cover,
        images,
        generatedImages: Object.fromEntries(sortedGenEntries),
      };
    });

    return NextResponse.json({
      data: formattedProducts,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
