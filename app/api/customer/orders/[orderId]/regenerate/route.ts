import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { uploadGeneratedAsset, isStorageConfigured } from '@/lib/storage';

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
    const { poseId, promptSuggestions, suggestion, customPromptOverride } = body;
    const activeSuggestion = (promptSuggestions || suggestion || customPromptOverride || '').trim();

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

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const baseUrl = (process.env.NEXTAUTH_URL || `${protocol}://${host}`).replace(/\/$/, '');

    // Forward to the main generate endpoint with existing order context
    const generateRes = await fetch(`${baseUrl}/api/generate`, {
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
        userId: (session?.user as any)?.id || order.userId || 'customer',
        promptSuggestions: activeSuggestion || undefined,
        icp: (order as any).icp,
        occasion: (order as any).occasion,
        fabricType: (order as any).fabricType,
        sareeDesignType: (order as any).sareeDesignType,
        borderStyle: (order as any).borderStyle,
        tasselStyle: (order as any).tasselStyle,
        blouseStyle: (order as any).blouseStyle,
      }),
    });

    if (!generateRes.ok && generateRes.status !== 202) {
      const errText = await generateRes.text();
      return NextResponse.json({ error: `Generation failed: ${errText}` }, { status: generateRes.status });
    }

    const generateData = await generateRes.json();
    let newImageUrl = (generateData.imageUrl || generateData.url || '').trim();

    // If Kie.ai task is processing asynchronously, poll task-status
    if (!newImageUrl && generateData.taskId && (generateData.isProcessing || generateRes.status === 202)) {
      console.log(`[Regenerate] Pose ${poseId} is processing asynchronously on Kie.ai (Task: ${generateData.taskId}). Polling task status...`);
      const providerParam = generateData.provider ? `&provider=${generateData.provider}` : '';
      const uId = (session?.user as any)?.id || order.userId || 'customer';
      
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const checkRes = await fetch(`${baseUrl}/api/task-status?taskId=${generateData.taskId}&userId=${uId}&orderId=${orderId}&poseId=${poseId}${providerParam}`);
        if (checkRes.ok) {
          const cd = await checkRes.json();
          if (cd.status === 'completed' && cd.imageUrl) {
            newImageUrl = (cd.imageUrl as string).trim();
            break;
          }
          if (cd.status === 'failed') {
            return NextResponse.json({ error: cd.error || 'Generation failed' }, { status: 500 });
          }
        }
      }
    }

    if (!newImageUrl) {
      return NextResponse.json({ error: 'No image URL returned from generation' }, { status: 500 });
    }

    // Strictly ensure image is permanently uploaded (Cloudflare R2 or Google Drive fallback)
    const isKieTemp = newImageUrl.includes('tempfile') || newImageUrl.includes('aiquickdraw') || newImageUrl.includes('kie.ai');
    const isPermanent = newImageUrl.includes('r2.dev') || newImageUrl.includes('cloudflarestorage.com') || newImageUrl.includes('googleusercontent.com') || newImageUrl.includes('drive.google.com');
    if (isStorageConfigured() && (isKieTemp || !isPermanent)) {
      let uploadSuccess = false;
      for (let rAttempt = 1; rAttempt <= 3; rAttempt++) {
        try {
          console.log(`[Regenerate] Storing regenerated image to Cloudflare R2 (attempt ${rAttempt}/3)...`);
          newImageUrl = await uploadGeneratedAsset(
            newImageUrl,
            (session?.user as any)?.id || order.userId || 'customer',
            orderId,
            poseId,
            { productName: order.productName || undefined, stockCode: order.stockCode || undefined }
          );
          uploadSuccess = true;
          console.log(`[Regenerate] ✅ Regenerated image permanently stored in R2: ${newImageUrl}`);
          break;
        } catch (r2Err: any) {
          console.warn(`[Regenerate] Cloudflare R2 upload attempt ${rAttempt}/3 failed:`, r2Err?.message);
          if (rAttempt < 3) await new Promise(r => setTimeout(r, rAttempt * 1000));
        }
      }

      if (!uploadSuccess && isKieTemp) {
        return NextResponse.json({
          error: 'Image was regenerated, but failed to save permanently to Cloudflare R2 storage. Please retry.',
        }, { status: 500 });
      }
    }

    // Update just that pose's image in the order
    const existingImages = (order.generatedImages as Record<string, any>) || {};
    const updatedImages = {
      ...existingImages,
      [poseId]: {
        imageUrl: newImageUrl,
        prompt: generateData.prompt || existingImages[poseId]?.prompt || '',
        generatedAt: new Date().toISOString(),
      },
    };

    await prisma.customerOrder.update({
      where: { id: orderId },
      data: { generatedImages: updatedImages as any },
    });

    // Synchronize to Product inventory
    try {
      const targetProduct = (order as any).productId
        ? await prisma.product.findUnique({ where: { id: (order as any).productId } })
        : (order.stockCode ? await prisma.product.findFirst({ where: { OR: [{ stockCode: order.stockCode }, { code1: order.stockCode }] } }) : null);

      if (targetProduct) {
        const prodGen = (targetProduct.generatedImages as Record<string, any>) || {};
        const mergedProd = {
          ...prodGen,
          [poseId]: {
            imageUrl: newImageUrl,
            prompt: generateData.prompt || '',
            generatedAt: new Date().toISOString(),
          },
        };
        await prisma.product.update({
          where: { id: targetProduct.id },
          data: {
            generatedImages: mergedProd as any,
            coverImageUrl: targetProduct.coverImageUrl || newImageUrl,
          },
        });
        console.log(`[Regenerate] Synced regenerated pose ${poseId} to Product ${targetProduct.stockCode}`);
      }
    } catch (prodErr) {
      console.warn('[Regenerate] Failed to sync to Product:', prodErr);
    }

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
