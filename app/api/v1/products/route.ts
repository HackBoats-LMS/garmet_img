import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Auth: simple API key header check
function checkApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
  return key === process.env.SYNC_API_KEY;
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
        { friendlyCode: { contains: search, mode: 'insensitive' } },
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
          friendlyCode: true,
          title: true,
          description: true,
          color: true,
          clothType: true,
          price: true,
          mrp: true,
          quantity: true,
          reservedQty: true,
          soldQty: true,
          status: true,
          coverImageUrl: true,
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

    return NextResponse.json({
      data: products,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
