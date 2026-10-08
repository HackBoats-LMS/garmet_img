import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/admin/design-groups?productCode=DES-01
// Returns design group + all linked stock codes for a given design number
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const productCode = searchParams.get('productCode') || '';
    const search = searchParams.get('search') || '';

    if (productCode) {
      // Look up a specific design group by design number
      const group = await prisma.productDesignGroup.findUnique({
        where: { designNumber: productCode },
        include: {
          stockEntries: {
            select: {
              id: true,
              stockCode: true,
              code1: true,
              quantity: true,
              status: true,
              unitPrice: true,
              location: true,
              coverImageUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      return NextResponse.json({ group: group || null });
    }

    // List all design groups (with search)
    const where: any = {};
    if (search) {
      where.OR = [
        { designNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const groups = await prisma.productDesignGroup.findMany({
      where,
      include: {
        stockEntries: {
          select: {
            id: true,
            stockCode: true,
            quantity: true,
            status: true,
            location: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ groups });
  } catch (error: any) {
    console.error('[DesignGroups GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/design-groups — create a new design group
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      productCode, title, description, coverImageUrl,
      color, clothType, embroideryType, cutStyle, border,
      kurtaLength, pantStyle, tags,
      whatsappRetail, whatsappWholesale, instagramCaption,
      facebookCaption, shopifyTitle, whatsappCatalogueTitle,
      // Optionally link existing product IDs to this group
      productIds,
    } = body;

    if (!productCode || !title) {
      return NextResponse.json({ error: 'productCode and title are required' }, { status: 400 });
    }

    const group = await prisma.productDesignGroup.create({
      data: {
        designNumber: productCode.trim(),
        title,
        description: description || null,
        coverImageUrl: coverImageUrl || null,
        color: color || null,
        clothType: clothType || null,
        embroideryType: embroideryType || null,
        cutStyle: cutStyle || null,
        border: border || null,
        kurtaLength: kurtaLength || null,
        pantStyle: pantStyle || null,
        tags: tags || [],
        whatsappRetail: whatsappRetail || null,
        whatsappWholesale: whatsappWholesale || null,
        instagramCaption: instagramCaption || null,
        facebookCaption: facebookCaption || null,
        shopifyTitle: shopifyTitle || null,
        whatsappCatalogueTitle: whatsappCatalogueTitle || null,
      },
    });

    // Link any existing products
    if (productIds && productIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { designGroupId: group.id },
      });
    }

    const full = await prisma.productDesignGroup.findUnique({
      where: { id: group.id },
      include: {
        stockEntries: {
          select: { id: true, stockCode: true, quantity: true, status: true },
        },
      },
    });

    return NextResponse.json({ group: full }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Design number already exists' }, { status: 409 });
    }
    console.error('[DesignGroups POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
