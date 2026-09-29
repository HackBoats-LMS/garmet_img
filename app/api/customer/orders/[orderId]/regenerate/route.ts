import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    const { orderId } = await params;
    const body = await req.json();
    const { poseId } = body;

    if (!orderId || !poseId) {
      return NextResponse.json({ error: 'orderId and poseId are required' }, { status: 400 });
    }

    // Fetch the existing order with full context
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        template: {
          include: {
            poses: true,
            imageSlots: true,
            customOptions: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const pose = order.template?.poses.find((p) => p.id === poseId);
    if (!pose) {
      return NextResponse.json({ error: 'Pose not found in template' }, { status: 404 });
    }

    // Fetch the selected model
    let model: { promptAnchor: string; imageUrl: string | null } | null = null;
    if (order.selectedModelId) {
      model = await prisma.aIModel.findUnique({
        where: { id: order.selectedModelId },
        select: { promptAnchor: true, imageUrl: true },
      });
    }

    const aspectRatio = (order as any).aspectRatio || '3:4';
    const uploadedImages = (order.uploadedImages as Record<string, string>) || {};
    const selectedOptions = (order.selectedOptions as Record<string, string>) || {};

    // Forward to the main generate endpoint with existing order context
    const generateRes = await fetch(`${process.env.NEXTAUTH_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Authentic raw commercial catalogue fashion photography of a stunning high-fashion Indian female model elegantly dressed in an authentic luxury ${order.productName || order.template?.name}. Pose & Angle: ${pose.name} — ${pose.promptSnippet}. Photography & Aesthetics: Shot on Hasselblad H6D-100c with HC 100mm f/2.2 lens in a high-end luxury fashion studio, softbox key lighting, soft natural ambient shadows, photorealistic skin with natural pores and subtle skin texture, 8k UHD editorial Vogue India fashion catalogue.`,
        negativePrompt: 'doll, plastic skin, barbie doll, mannequin, 3d render, CGI, cartoon, anime, airbrushed, fake eyes, artificial skin, watermark, signature, blurry',
        uploadedImages,
        selectedOptions,
        modelFaceUrl: model?.imageUrl || null,
        posePreviewUrl: pose.previewImage || null,
        templateId: order.templateId,
        orderId,
        poseId,
        productName: order.productName,
        stockCode: order.stockCode,
        aspectRatio,
        userId: (session?.user as any)?.id || 'customer',
      }),
    });

    if (!generateRes.ok) {
      const errText = await generateRes.text();
      return NextResponse.json({ error: `Generation failed: ${errText}` }, { status: generateRes.status });
    }

    const generateData = await generateRes.json();
    const newImageUrl = generateData.imageUrl || generateData.url;

    if (!newImageUrl) {
      return NextResponse.json({ error: 'No image URL returned from generation' }, { status: 500 });
    }

    // Update just that pose's image in the order
    const existingImages = (order.generatedImages as Record<string, { imageUrl: string; prompt?: string }>) || {};
    const updatedImages = {
      ...existingImages,
      [poseId]: {
        imageUrl: newImageUrl,
        prompt: generateData.prompt || existingImages[poseId]?.prompt || '',
      },
    };

    await prisma.customerOrder.update({
      where: { id: orderId },
      data: { generatedImages: updatedImages as any },
    });

    return NextResponse.json({
      success: true,
      poseId,
      imageUrl: newImageUrl,
    });
  } catch (err) {
    console.error('[Regenerate] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
