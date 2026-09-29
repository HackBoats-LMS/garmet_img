import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// PATCH /api/admin/design-groups/[id]
// Use to: update group details OR link/unlink a stock code
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

    // Special action: link / unlink a product stock code
    const { linkProductId, unlinkProductId, ...fields } = body;

    if (linkProductId) {
      // Link a product to this design group
      await prisma.product.update({
        where: { id: linkProductId },
        data: { designGroupId: id },
      });
      const updated = await prisma.productDesignGroup.findUnique({
        where: { id },
        include: {
          stockEntries: {
            select: { id: true, stockCode: true, quantity: true, status: true, location: true },
          },
        },
      });
      return NextResponse.json({ group: updated });
    }

    if (unlinkProductId) {
      // Remove a product from this design group
      await prisma.product.update({
        where: { id: unlinkProductId },
        data: { designGroupId: null },
      });
      const updated = await prisma.productDesignGroup.findUnique({
        where: { id },
        include: {
          stockEntries: {
            select: { id: true, stockCode: true, quantity: true, status: true, location: true },
          },
        },
      });
      return NextResponse.json({ group: updated });
    }

    // General field update
    const group = await prisma.productDesignGroup.update({
      where: { id },
      data: {
        title: fields.title ?? undefined,
        description: fields.description ?? undefined,
        coverImageUrl: fields.coverImageUrl ?? undefined,
        color: fields.color ?? undefined,
        clothType: fields.clothType ?? undefined,
        embroideryType: fields.embroideryType ?? undefined,
        cutStyle: fields.cutStyle ?? undefined,
        border: fields.border ?? undefined,
        kurtaLength: fields.kurtaLength ?? undefined,
        pantStyle: fields.pantStyle ?? undefined,
        tags: fields.tags ?? undefined,
        whatsappRetail: fields.whatsappRetail ?? undefined,
        whatsappWholesale: fields.whatsappWholesale ?? undefined,
        instagramCaption: fields.instagramCaption ?? undefined,
        facebookCaption: fields.facebookCaption ?? undefined,
        shopifyTitle: fields.shopifyTitle ?? undefined,
        whatsappCatalogueTitle: fields.whatsappCatalogueTitle ?? undefined,
      },
      include: {
        stockEntries: {
          select: { id: true, stockCode: true, quantity: true, status: true, location: true },
        },
      },
    });

    return NextResponse.json({ group });
  } catch (error: any) {
    console.error('[DesignGroups PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/admin/design-groups/[id]
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
    const group = await prisma.productDesignGroup.findUnique({
      where: { id },
      include: {
        stockEntries: {
          select: {
            id: true, stockCode: true, friendlyCode: true,
            quantity: true, status: true, price: true,
            location: true, coverImageUrl: true, createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ group });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
