import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/categories/backfill
 * Previews products that have categoryId: null and how they would be classified
 * 
 * POST /api/admin/categories/backfill
 * Safely updates categoryId for unlinked products without data loss
 */

function classifyProduct(product: { productName?: string | null; code1?: string | null; stockCode?: string | null }) {
  const text = `${product.productName || ''} ${product.code1 || ''} ${product.stockCode || ''}`.toUpperCase();
  if (text.match(/KURT|KPD|KP-|KURTA/)) {
    return 'kurthi';
  }
  if (text.match(/SAREE|SARI|BANDANI|PANCHAVATI|DILRUBA|VIVA|SHAGUN|KESAR/)) {
    return 'Saree';
  }
  // Default fallback for garments
  return 'Saree';
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await prisma.category.findMany();
    const sareeCat = categories.find(c => c.slug.toLowerCase() === 'saree');
    const kurthiCat = categories.find(c => c.slug.toLowerCase().includes('kurth') || c.slug.toLowerCase().includes('kurt'));

    const unlinked = await prisma.product.findMany({
      where: { categoryId: null },
      select: {
        id: true,
        stockCode: true,
        code1: true,
        productName: true,
      },
    });

    let sareeCount = 0;
    let kurthiCount = 0;
    const previewList = unlinked.slice(0, 50).map(p => {
      const detected = classifyProduct(p);
      if (detected === 'kurthi') kurthiCount++;
      else sareeCount++;
      return {
        id: p.id,
        stockCode: p.stockCode,
        code1: p.code1,
        productName: p.productName,
        suggestedCategory: detected,
        targetCategoryId: detected === 'kurthi' ? kurthiCat?.id : sareeCat?.id,
      };
    });

    // Count full counts
    let totalSaree = 0;
    let totalKurthi = 0;
    unlinked.forEach(p => {
      if (classifyProduct(p) === 'kurthi') totalKurthi++;
      else totalSaree++;
    });

    return NextResponse.json({
      success: true,
      totalUnlinked: unlinked.length,
      detectedCounts: {
        kurthi: totalKurthi,
        saree: totalSaree,
      },
      availableCategories: categories,
      preview: previewList,
    });
  } catch (error: any) {
    console.error('[Categories Backfill GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { mode = 'auto' } = body;

    const categories = await prisma.category.findMany();
    let sareeCat = categories.find(c => c.slug.toLowerCase() === 'saree');
    let kurthiCat = categories.find(c => c.slug.toLowerCase().includes('kurth') || c.slug.toLowerCase().includes('kurt'));

    // If categories don't exist, create them
    if (!sareeCat) {
      sareeCat = await prisma.category.create({ data: { name: 'Saree', slug: 'saree' } });
    }
    if (!kurthiCat) {
      kurthiCat = await prisma.category.create({ data: { name: 'kurthi', slug: 'kurthi' } });
    }

    const unlinked = await prisma.product.findMany({
      where: { categoryId: null },
      select: {
        id: true,
        stockCode: true,
        code1: true,
        productName: true,
      },
    });

    const kurthiIds: string[] = [];
    const sareeIds: string[] = [];

    for (const p of unlinked) {
      const type = classifyProduct(p);
      if (type === 'kurthi') {
        kurthiIds.push(p.id);
      } else {
        sareeIds.push(p.id);
      }
    }

    let updatedKurthi = 0;
    let updatedSaree = 0;

    if (kurthiIds.length > 0 && kurthiCat) {
      const res = await prisma.product.updateMany({
        where: { id: { in: kurthiIds } },
        data: { categoryId: kurthiCat.id },
      });
      updatedKurthi = res.count;
    }

    if (sareeIds.length > 0 && sareeCat) {
      const res = await prisma.product.updateMany({
        where: { id: { in: sareeIds } },
        data: { categoryId: sareeCat.id },
      });
      updatedSaree = res.count;
    }

    return NextResponse.json({
      success: true,
      message: `Categorized ${updatedKurthi + updatedSaree} products without data loss: ${updatedKurthi} Kurthi, ${updatedSaree} Saree.`,
      updatedCount: updatedKurthi + updatedSaree,
      updatedKurthi,
      updatedSaree,
      remainingUnlinked: unlinked.length - (updatedKurthi + updatedSaree),
    });
  } catch (error: any) {
    console.error('[Categories Backfill POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
