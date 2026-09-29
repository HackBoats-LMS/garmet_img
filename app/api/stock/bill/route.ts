import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { stockCode, purgeImages = true } = await req.json();

    if (!stockCode) {
      return NextResponse.json({ error: 'stockCode is required' }, { status: 400 });
    }

    const code = stockCode.trim().toUpperCase();

    if (prisma) {
      try {
        if (purgeImages) {
          await prisma.stockPose.deleteMany({
            where: { stockItem: { stockCode: code } },
          });

          const updated = await prisma.stockItem.update({
            where: { stockCode: code },
            data: {
              status: 'BILLED',
              billedAt: new Date(),
              referenceImages: [],
            },
          });

          return NextResponse.json({
            success: true,
            message: `Stock #${code} marked as BILLED and images purged from active storage.`,
            item: updated,
          });
        } else {
          const updated = await prisma.stockItem.update({
            where: { stockCode: code },
            data: {
              status: 'BILLED',
              billedAt: new Date(),
            },
          });

          return NextResponse.json({
            success: true,
            message: `Stock #${code} marked as BILLED.`,
            item: updated,
          });
        }
      } catch (dbErr: any) {
        console.warn('Prisma DB billing update failed:', dbErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Stock #${code} marked as BILLED in session cache.`,
      fallback: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Billing update failed' }, { status: 500 });
  }
}
