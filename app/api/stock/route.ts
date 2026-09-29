import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StockItemData, StockPoseData } from '@/app/types/stock';

// In-memory cache fallback in case PostgreSQL is initializing
const inMemoryStockStore: Record<string, StockItemData> = {};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';

    // Attempt PostgreSQL query via Prisma if available
    if (prisma) {
      try {
        const whereClause: any = {};
        if (search) {
          whereClause.OR = [
            { stockCode: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { rawDescription: { contains: search, mode: 'insensitive' } },
          ];
        }
        if (status) {
          whereClause.status = status;
        }
        if (category) {
          whereClause.category = category;
        }

        const items = await prisma.stockItem.findMany({
          where: whereClause,
          include: { poses: { orderBy: { poseNumber: 'asc' } } },
          orderBy: { updatedAt: 'desc' },
        });

        return NextResponse.json({ items, source: 'postgres' });
      } catch (dbErr: any) {
        console.warn('Prisma query failed, using in-memory store fallback:', dbErr.message);
      }
    }

    // Fallback: in-memory list
    let items = Object.values(inMemoryStockStore);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.stockCode.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.rawDescription.toLowerCase().includes(q)
      );
    }
    if (status) {
      items = items.filter((i) => i.status === status);
    }
    if (category) {
      items = items.filter((i) => i.category === category);
    }

    return NextResponse.json({ items, source: 'memory_fallback' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch stock items' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: StockItemData = await req.json();

    if (!body.stockCode) {
      return NextResponse.json({ error: 'stockCode is required' }, { status: 400 });
    }

    const stockCode = body.stockCode.trim().toUpperCase();

    // Cache in memory fallback
    inMemoryStockStore[stockCode] = {
      ...body,
      stockCode,
      updatedAt: new Date().toISOString(),
    };

    // Attempt PostgreSQL persistence via Prisma if available
    if (prisma) {
      try {
        const savedItem = await prisma.stockItem.upsert({
          where: { stockCode },
          update: {
            title: body.title || `Garment #${stockCode}`,
            category: body.category || 'saree',
            price: body.price ? Number(body.price) : null,
            mrp: body.mrp ? Number(body.mrp) : null,
            rawDescription: body.rawDescription || '',
            status: (body.status as any) || 'ACTIVE',
            referenceImages: (body.referenceImages as any) || [],
            whatsappCopy: body.whatsappCopy || null,
            instagramCopy: body.instagramCopy || null,
            websiteCopy: body.websiteCopy || null,
            poses: {
              deleteMany: {},
              create: (body.poses || []).map((pose: StockPoseData) => ({
                poseNumber: pose.poseNumber,
                poseName: pose.poseName,
                imageUrl: pose.imageUrl,
                prompt: pose.prompt || '',
              })),
            },
          },
          create: {
            stockCode,
            title: body.title || `Garment #${stockCode}`,
            category: body.category || 'saree',
            price: body.price ? Number(body.price) : null,
            mrp: body.mrp ? Number(body.mrp) : null,
            rawDescription: body.rawDescription || '',
            status: (body.status as any) || 'ACTIVE',
            referenceImages: (body.referenceImages as any) || [],
            whatsappCopy: body.whatsappCopy || null,
            instagramCopy: body.instagramCopy || null,
            websiteCopy: body.websiteCopy || null,
            poses: {
              create: (body.poses || []).map((pose: StockPoseData) => ({
                poseNumber: pose.poseNumber,
                poseName: pose.poseName,
                imageUrl: pose.imageUrl,
                prompt: pose.prompt || '',
              })),
            },
          },
          include: { poses: { orderBy: { poseNumber: 'asc' } } },
        });

        return NextResponse.json({ item: savedItem, source: 'postgres' });
      } catch (dbErr: any) {
        console.warn('Prisma upsert failed, stored in memory fallback:', dbErr.message);
      }
    }

    return NextResponse.json({ item: inMemoryStockStore[stockCode], source: 'memory_fallback' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save stock item' }, { status: 500 });
  }
}
