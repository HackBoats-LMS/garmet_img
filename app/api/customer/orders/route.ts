import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

function mergeAndDeduplicateImages(
  existingImages: Record<string, any> = {},
  newImages: Record<string, any> = {}
): Record<string, any> {
  const merged: Record<string, any> = {};
  const seenUrls = new Set<string>();

  // Process newImages first so newest additions/updates take priority
  for (const [key, val] of Object.entries(newImages)) {
    const url = typeof val === 'string' ? val : (val as any)?.imageUrl;
    if (url) {
      const cleanUrl = url.trim().replace(/[\\'";,\s]+$/, '');
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        merged[key] = val;
      }
    } else {
      merged[key] = val;
    }
  }

  // Then add existingImages only if their imageUrl is NOT already present
  for (const [key, val] of Object.entries(existingImages)) {
    const url = typeof val === 'string' ? val : (val as any)?.imageUrl;
    if (url) {
      const cleanUrl = url.trim().replace(/[\\'";,\s]+$/, '');
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        merged[key] = val;
      }
    } else if (!merged[key]) {
      merged[key] = val;
    }
  }

  return merged;
}

// GET /api/customer/orders — List orders for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let userId = req.nextUrl.searchParams.get('userId');
    if (!userId && session?.user) {
      userId = (session.user as any).id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const orders = await prisma.customerOrder.findMany({
      where: { userId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImage: true,
            poses: { select: { id: true, name: true, category: true, previewImage: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/customer/orders — Save/update a customer order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      productId,
      userId,
      templateId,
      productName,
      stockCode,
      description,
      uploadedImages,
      selectedModelId,
      selectedOptions,
      aspectRatio,
      generatedImages,
      captions,
      status,
    } = body;

    if (!userId || !templateId) {
      return NextResponse.json(
        { error: 'userId and templateId are required' },
        { status: 400 }
      );
    }

    // Upsert: update if id provided, create otherwise
    if (id) {
      const deduplicatedOrderImages = generatedImages
        ? mergeAndDeduplicateImages({}, generatedImages as Record<string, any>)
        : undefined;

      const order = await prisma.customerOrder.update({
        where: { id },
        data: {
          productName: productName ?? undefined,
          stockCode: stockCode ?? undefined,
          description: description ?? undefined,
          uploadedImages: uploadedImages ?? undefined,
          selectedModelId: selectedModelId ?? undefined,
          selectedOptions: selectedOptions ?? undefined,
          aspectRatio: aspectRatio ?? undefined,
          generatedImages: deduplicatedOrderImages ?? undefined,
          captions: captions ?? undefined,
          status: status ?? undefined,
        },
      });

      // Auto-link: if order has (productId or stockCode) + generatedImages, attach to Product
      if ((productId || stockCode) && generatedImages && Object.keys(generatedImages).length > 0) {
        const product = productId
          ? await prisma.product.findUnique({ where: { id: productId } })
          : (stockCode ? await prisma.product.findFirst({ where: { OR: [{ stockCode }, { code1: stockCode }] } }) : null);
        if (product) {
          const existingImages = (product.generatedImages as Record<string, any>) || {};
          const newImages = (generatedImages as Record<string, any>) || {};
          const mergedImages = mergeAndDeduplicateImages(existingImages, newImages);
          const firstImage = Object.values(mergedImages as Record<string, {imageUrl: string}>)[0];

          await prisma.product.update({
            where: { id: product.id },
            data: {
              generatedImages: mergedImages as any,
              linkedOrderId: id,
              aspectRatio: aspectRatio || product.aspectRatio,
              coverImageUrl: product.coverImageUrl || firstImage?.imageUrl,
              captions: captions ? captions as any : product.captions,
            },
          });
        }
      }

      return NextResponse.json({ order });
    }

    const deduplicatedNewOrderImages = generatedImages
      ? mergeAndDeduplicateImages({}, generatedImages as Record<string, any>)
      : null;

    const order = await prisma.customerOrder.create({
      data: {
        userId,
        templateId,
        productName: productName || null,
        stockCode: stockCode || null,
        description: description || null,
        uploadedImages: uploadedImages || null,
        selectedModelId: selectedModelId || null,
        selectedOptions: selectedOptions || null,
        aspectRatio: aspectRatio || '3:4',
        generatedImages: deduplicatedNewOrderImages as any,
        captions: captions || null,
        status: status || 'draft',
      },
    });

    // Auto-link for newly created order
    if ((productId || stockCode) && generatedImages && Object.keys(generatedImages).length > 0) {
      const product = productId
        ? await prisma.product.findUnique({ where: { id: productId } })
        : (stockCode ? await prisma.product.findFirst({ where: { OR: [{ stockCode }, { code1: stockCode }] } }) : null);
      if (product) {
        const existingImages = (product.generatedImages as Record<string, any>) || {};
        const newImages = (generatedImages as Record<string, any>) || {};
        const mergedImages = mergeAndDeduplicateImages(existingImages, newImages);
        const firstImage = Object.values(mergedImages as Record<string, {imageUrl: string}>)[0];

        await prisma.product.update({
          where: { id: product.id },
          data: {
            generatedImages: mergedImages as any,
            linkedOrderId: order.id,
            aspectRatio: aspectRatio || product.aspectRatio,
            coverImageUrl: product.coverImageUrl || firstImage?.imageUrl,
            captions: captions ? captions as any : product.captions,
          },
        });
      }
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error: any) {
    console.error('[Customer Orders POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
