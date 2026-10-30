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
 *   ?search=        full-text search
 *   ?category=      category slug e.g. "saree"
 *   ?subCategory=   sub-category slug e.g. "silk"
 *   ?status=        ACTIVE | OUT_OF_STOCK | ARCHIVED
 *   ?limit=         default 50, max 100
 *   ?page=          default 1 (legacy offset pagination)
 *   ?cursor=        cursor ID for cursor-based pagination (preferred, uses CUID time-ordering)
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const cursorId = searchParams.get('cursor'); // CUID cursor (time-ordered)
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {};

    if (status !== 'ALL') where.status = status;

    if (search) {
      where.OR = [
        { stockCode: { contains: search, mode: 'insensitive' } },
        { code1: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (subCategorySlug) {
      where.subCategory = { slug: subCategorySlug };
    }

    // Use cursor pagination if cursor provided, otherwise fall back to offset
    const useCursor = !!cursorId;
    const take = limit + 1; // Fetch one extra to determine hasNextPage

    let products;
    if (useCursor) {
      products = await prisma.product.findMany({
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
        orderBy: { id: 'desc' }, // CUIDs are time-ordered
        cursor: { id: cursorId },
        take,
      });
    } else {
      products = await prisma.product.findMany({
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
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    // Determine if there's a next page
    const hasNextPage = products.length > limit;
    const items = hasNextPage ? products.slice(0, limit) : products;

    // Generate next cursor from last item (use CUID)
    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      nextCursor = items[items.length - 1].id;
    }

    const formattedProducts = items.map((p) => {
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
      nextCursor,
      hasNextPage,
      limit,
      // Legacy pagination info (only when using offset)
      ...(!useCursor && { page, pages: Math.ceil((await prisma.product.count({ where })) / limit) }),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
