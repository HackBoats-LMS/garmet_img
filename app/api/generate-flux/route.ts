import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { uploadGeneratedAsset, uploadToStorage, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Helper: Convert local public path or resolve data URL / remote URL
function resolveImageToDataUrl(imgStr: string): string | null {
  if (!imgStr) return null;
  if (imgStr.startsWith('data:image/')) return imgStr;
  if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) return imgStr;

  if (imgStr.startsWith('/')) {
    try {
      const publicPath = path.join(process.cwd(), 'public', imgStr.replace(/^\//, ''));
      if (fs.existsSync(publicPath)) {
        const fileBuf = fs.readFileSync(publicPath);
        const ext = path.extname(publicPath).replace('.', '').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${fileBuf.toString('base64')}`;
      }
    } catch (e) {
      console.warn('[API /generate] Failed to resolve public image path:', imgStr, e);
    }
  }
  return null;
}



export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      prompt,
      referenceImageUrl,
      referenceImages,
      modelFaceUrl,
      posePreviewUrl,
      userId: reqUserId,
      templateId,
      orderId,
      poseId,
      productName,
      stockCode,
      description,
      uploadedImages,
      icp,
      occasion,
      fabricType,
      selectedModelId,
      selectedOptions,
      crop = false,
      seed = 42,
      steps = 30,
      aspectRatio = '3:4',
    } = body;

    const userId = reqUserId || (session?.user as any)?.id || 'anonymous_user';

    // Fetch Template & Pose from DB
    const template = templateId ? await prisma.garmentTemplate.findUnique({
      where: { id: templateId },
      include: { poses: true }
    }) : null;

    const dbPose = template && poseId ? template.poses.find((p: any) => p.id === poseId) : null;

    // 1. Determine active Kie.ai model from KieModel DB table
    let kieModelId = 'flux-2/pro-image-to-image'; // fallback
    try {
      // Try KieModel table first (admin-managed)
      const kieRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT "modelId" FROM "KieModel" WHERE "isDefault" = true AND "isActive" = true LIMIT 1;`
      );
      if (kieRows?.[0]?.modelId) {
        kieModelId = kieRows[0].modelId;
      } else {
        // Fallback: read from StudioConfig
        const cfgRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT "selectedEngine" FROM "StudioConfig" WHERE "id" = 'global_studio_config' LIMIT 1;`
        );
        if (cfgRows?.[0]?.selectedEngine) {
          kieModelId = cfgRows[0].selectedEngine;
        }
      }
    } catch (e) {
      console.warn('[Generate Route] Using fallback Kie.ai model:', e);
    }

    console.log(`[API /generate] Kie.ai Model: ${kieModelId}`);

    // Collect all valid reference images
    const rawImageList: string[] = [];
    const resolvedModelFace = modelFaceUrl ? resolveImageToDataUrl(modelFaceUrl) : null;
    const resolvedPosePreview = posePreviewUrl ? resolveImageToDataUrl(posePreviewUrl) : null;

    if (resolvedModelFace) {
      rawImageList.push(resolvedModelFace);
    }

    if (Array.isArray(referenceImages)) {
      for (const img of referenceImages) {
        const resolved = resolveImageToDataUrl(img);
        if (resolved && resolved !== resolvedModelFace) {
          rawImageList.push(resolved);
        }
      }
    }
    if (rawImageList.length === 0 && referenceImageUrl) {
      const resolved = resolveImageToDataUrl(referenceImageUrl);
      if (resolved) rawImageList.push(resolved);
    }

    const cleanPrompt = (prompt || '').replace(/--ar\s+\d+:\d+/gi, '').trim();

    // ─────────────────────────────────────────────────────────────
    // PIAPI GEMINI 3.1 FLASH-LITE IMAGE ENGINE
    // Sends ALL fabric images + model face directly to Gemini
    // Gemini natively understands multiple images — no Cloudinary needed!
    // ─────────────────────────────────────────────────────────────
    const rawKieKey = (process.env.KIE_API_KEY || process.env.PIAPI_API_KEY || '').trim();
    const kieApiKeyBearer = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!kieApiKeyBearer) {
      return NextResponse.json(
        {
          error: 'KIE_API_KEY is not configured. Please add KIE_API_KEY to your .env.local file.',
          needsKey: true,
        },
        { status: 401 }
      );
    }

    // 1. Collect ALL reference images as base64 for Gemini multimodal input
    const geminiImageParts: { inline_data: { mime_type: string; data: string } }[] = [];

    // Helper: extract raw base64 from data URL or resolve file
    const addImagePart = (imgStr: string | null, label: string) => {
      if (!imgStr) return;
      const resolved = resolveImageToDataUrl(imgStr);
      if (!resolved) return;

      if (resolved.startsWith('data:image/')) {
        const match = resolved.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          geminiImageParts.push({
            inline_data: { mime_type: match[1], data: match[2] },
          });
          console.log(`[Gemini] Added ${label} image (${match[1]}, ${Math.round(match[2].length / 1024)}KB base64)`);
        }
      } else if (resolved.startsWith('http')) {
        // For remote URLs, we'll pass them as-is and Gemini will fetch them
        console.log(`[Gemini] Skipping remote URL for ${label} (Gemini prefers inline_data)`);
      }
    };

    // Add all uploaded fabric images (body, pallu, blouse, etc.)
    if (uploadedImages && typeof uploadedImages === 'object') {
      const slotNames = Object.keys(uploadedImages);
      for (const slotId of slotNames) {
        const imgData = uploadedImages[slotId] as string;
        if (imgData) {
          addImagePart(imgData, `fabric_${slotId}`);
        }
      }
    }

    // Also add from referenceImages array (these may include fabric + model face)
    if (Array.isArray(referenceImages)) {
      for (let i = 0; i < referenceImages.length; i++) {
        const img = referenceImages[i];
        // Avoid duplicating images already added from uploadedImages
        if (img && !Object.values(uploadedImages || {}).includes(img)) {
          addImagePart(img, `reference_${i}`);
        }
      }
    }

    // Add single reference image if no others were found
    if (geminiImageParts.length === 0 && referenceImageUrl) {
      addImagePart(referenceImageUrl, 'garment_reference');
    }

    // Add model face image
    if (modelFaceUrl) {
      addImagePart(modelFaceUrl, 'model_face');
    }

    console.log(`[Kie.ai] Total reference images collected: ${geminiImageParts.length}`);

    // 2. Build Kie.ai prompt with explicit fabric & image instructions
    const fabricCount = Object.keys(uploadedImages || {}).filter(k => uploadedImages[k]).length;
    const slotLabels = Object.keys(uploadedImages || {}).filter(k => uploadedImages[k]);

    let imageInstructions = '';
    const defaultGarmentType = 'map the uploaded fabric swatches precisely to the corresponding garment sections';
    const garmentMapping = template?.garmentType || defaultGarmentType;

    // Inject admin-described fabric mapping
    if (fabricCount > 0) {
      const labelDescriptions = slotLabels.map((label, i) => {
        const cleanLabel = label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `Image ${i + 1}: ${cleanLabel}`;
      });
      imageInstructions = `I am providing ${fabricCount} reference fabric swatch image(s) in order:\n${labelDescriptions.join('\n')}\n` +
        `You MUST use the EXACT colors, patterns, motifs, weave texture, and design from these fabric swatches. ` +
        `Instruction: ${garmentMapping}. ` +
        `Do NOT invent new patterns or colors for the provided swatches. The generated garment sections must be a pixel-accurate replication of the provided fabric images.\n` +
        `CRITICAL: If any optional garment component (like Pant, Bottoms, or Dupatta) is NOT provided in the images above, you MUST automatically design and generate them to perfectly complement the provided body fabric according to high-end fashion taste.`;
    }

    // Dynamic Background & Vibe Logic
    let dynamicBackground = 'Muted neutral background, soft daylight 9am-2pm, window/open shade';
    let dynamicStyling = '';

    // Occasion matching
    if (occasion === 'Onam / festival') dynamicBackground = 'Mirror or courtyard, warm light. Vibe: Rooted, festive';
    else if (occasion === 'Kitty party') dynamicBackground = 'Café / friend\'s living room. Vibe: Noticed';
    else if (occasion === 'Parent-teacher meet') dynamicBackground = 'Home entrance w/ bag or car-side. Vibe: Capable';
    else if (occasion === 'Small get-together') dynamicBackground = 'Living room / dining. Vibe: Unhurried';
    else if (occasion === 'Workday') dynamicBackground = 'Office corridor. Vibe: Professional';
    else if (fabricType) {
      // Fabric matching (fallback)
      if (fabricType === 'Linen / light cotton') dynamicBackground = 'Balcony / terrace (open shade). Vibe: Airy, breathable, light-filled';
      else if (fabricType === 'Everyday cotton / ajrakh / print') dynamicBackground = 'Home doorway / living room. Vibe: Everyday home, daylight';
      else if (fabricType === 'Tussar / silk / premium') dynamicBackground = 'Mirror / dressing corner (warm light). Vibe: Rich getting-ready ritual, premium';
      else if (fabricType === 'Kurti set (any)') dynamicBackground = 'Office / car-side / home entrance. Vibe: On-the-go';
    }

    // ICP matching
    if (icp === 'home_ceo') {
      dynamicStyling = 'Expression: Composed, gracious, private half-smile. Hand moments: Pallu at shoulder, teacup, hand on doorframe, tuck pleats, house keys. Styling: Small gold jhumkas/studs, 1-2 bangles, bindi, low bun or done-open, structured handbag, flats/kolhapuris, elbow-sleeve blouse. Light: Soft daylight 9am-2pm.';
    } else if (icp === 'professional') {
      dynamicStyling = 'Expression: Direct, capable, confident half-smile. Hand moments: Tote onto shoulder, phone, folder/laptop bag, watch, car door. Styling: Studs/small hoops, watch, bindi optional, open hair/ponytail, tote/laptop bag, block heels/loafers, glasses ok, fitted short-sleeve blouse. Light: Soft daylight 9am-2pm.';
    }

    // Default template fallbacks (if not configured in DB)
    const fallbackSystemPrompt = 'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style.';
    const fallbackCamera = 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, razor-sharp focus, crisp details, hyper-realistic depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting. Eye-level (peer POV), face always visible.';
    const fallbackNegative = 'bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, out of focus, soft focus, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses, bright flash, evening bulb light, garish colors, pattern behind print';
    
    const sysPrompt = template?.systemPrompt || fallbackSystemPrompt;
    const camSettings = template?.cameraSettings || fallbackCamera;
    const negPrompt = template?.negativePrompt || fallbackNegative;
    
    // The pose snippet from DB
    const posePrompt = dbPose?.promptSnippet || '';
    
    // Combine into final prompt
    const fluxPrompt = `${imageInstructions}\n\nUser Additions: ${cleanPrompt}\nPose Direction: ${posePrompt}\nBackground & Vibe: ${dynamicBackground}\nStyling & Persona Rules: ${dynamicStyling}\n\nCRITICAL REQUIREMENTS:\n- Generate an ultra-photorealistic fashion photograph, NOT an illustration, painting, or 3D render.\n- ${sysPrompt}\n- ${camSettings}\n- ABSOLUTELY NO TEXT, NO LOGOS, NO WATERMARKS, NO MAGAZINE COVERS. The image must be clean of any typographic elements.\n- Extreme emphasis on ultra-realistic human anatomy, highly detailed natural skin texture with visible pores and micro-details, hyper-realistic eyes, and perfect natural fabric draping.\n- MACRO DETAIL PRESERVATION: You must flawlessly preserve every single microscopic detail of the uploaded fabric. Do not smooth out embroidery, zari work, sequins, or weave textures. Keep the texture hyper-sharp, tactile, and highly defined with absolutely zero blur or softness.`;

    // 3. Build Kie.ai request body

    // Helper function to upload to ImgBB (Free anonymous hosting for Kie.ai to read)
    const uploadToImgBB = async (base64Data: string, apiKey: string) => {
      // Remove the prefix to just get the raw base64 string
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const formData = new FormData();
      formData.append('image', cleanBase64);
      // Set expiration to 24 hours (86400 seconds) so images don't delete while Kie.ai is still queuing
      formData.append('expiration', '86400');

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`ImgBB upload failed: ${await res.text()}`);
      }

      const data = await res.json();
      return data.data.url; // Returns a direct .jpg/.png URL
    };

    let inputUrls: string[] = [];
    if (geminiImageParts.length > 0) {
      const imgbbKey = process.env.IMGBB_API_KEY;
      if (!imgbbKey) {
        return NextResponse.json(
          { error: 'IMGBB_API_KEY is not configured in environment variables. Please add it to your .env file.' },
          { status: 500 }
        );
      }

      for (let i = 0; i < geminiImageParts.length; i++) {
        const part = geminiImageParts[i];
        const dataUrl = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;

        try {
          console.log(`[Kie.ai] Uploading reference image ${i + 1} to ImgBB for temporary hosting...`);
          const imgUrl = await uploadToImgBB(dataUrl, imgbbKey);
          inputUrls.push(imgUrl);
        } catch (err) {
          console.error(`[Kie.ai] Failed to upload image ${i + 1} to ImgBB:`, err);
          return NextResponse.json(
            { error: `Failed to upload image to ImgBB. Check your API key. Error: ${err}` },
            { status: 500 }
          );
        }
      }
      console.log(`[Kie.ai] Successfully uploaded ${inputUrls.length} images to ImgBB`);
    }

    // Determine model — prefer image-to-image when we have input images, else text-to-image
    // But always respect the admin-chosen model if it is explicitly an image-to-image type
    let finalKieModel = kieModelId;
    if (inputUrls.length === 0 && kieModelId.includes('image-to-image')) {
      // Fallback to text model when no reference images provided
      finalKieModel = kieModelId.replace('image-to-image', 'text-to-image');
    }

    // Map pro to flex if that's the correct Kie.ai identifier for image-to-image
    if (finalKieModel === 'flux-2/pro-image-to-image') {
      finalKieModel = 'flux-2/pro-image-to-image';
    }

    const kieRequestBody: any = {
      model: finalKieModel,
      input: {
        prompt: fluxPrompt,
        aspect_ratio: aspectRatio || '3:4',
        resolution: '1K',
      },
    };

    // Flux models reject unknown parameters like negative_prompt and background, but want nsfw_checker
    if (finalKieModel.toLowerCase().includes('flux')) {
      kieRequestBody.input.nsfw_checker = false;
    } else {
      kieRequestBody.input.negative_prompt = negPrompt;
    }

    if (inputUrls.length > 0) {
      kieRequestBody.input.input_urls = inputUrls;
    }

    const endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
    console.log(`[Kie.ai] Model: ${finalKieModel} | input_urls: ${inputUrls.length}`);
    console.log(`[Kie.ai] Submitting task to ${endpoint}...`);

    let submitRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieApiKeyBearer}`,
      },
      body: JSON.stringify(kieRequestBody),
    });

    let submitText = await submitRes.text();
    console.log(`[Kie.ai] Submit response status: ${submitRes.status} \n[Kie.ai] Full Response:`, submitText);

    if (!submitRes.ok) {
      return NextResponse.json(
        { error: `Kie.ai Submit Error (${submitRes.status}): ${submitText}` },
        { status: submitRes.status }
      );
    }

    let submitData: any = {};
    try {
      submitData = JSON.parse(submitText);
    } catch {
      return NextResponse.json(
        { error: `Kie.ai returned non-JSON response: ${submitText}` },
        { status: 500 }
      );
    }

    const taskId = submitData?.data?.taskId || submitData?.data?.id || submitData?.data?.task_id || submitData?.task_id || submitData?.id || submitData?.taskId;
    if (!taskId) {
      return NextResponse.json(
        { error: `No task ID found in Kie.ai response: ${submitText}` },
        { status: 500 }
      );
    }

    console.log(`[Kie.ai] Task ID: ${taskId}. Polling for completion...`);

    // Poll task status (up to 80 attempts x 3s = ~240s / 4 minutes) to ensure it finishes and saves
    for (let attempt = 1; attempt <= 80; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const checkRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${kieApiKeyBearer}`,
        },
      });

      const checkText = await checkRes.text();
      console.log(`[Kie.ai] Poll #${attempt} status: ${checkRes.status}`, checkText.slice(0, 200));

      if (!checkRes.ok) {
        return NextResponse.json(
          { error: `Kie.ai Poll Error (${checkRes.status}): ${checkText}`, taskId },
          { status: checkRes.status }
        );
      }

      let checkData: any = {};
      try {
        checkData = JSON.parse(checkText);
      } catch {
        continue;
      }

      const status = checkData?.data?.state || checkData?.state || checkData?.data?.status || checkData?.status;

      if (status === 'completed' || status === 'success') {
        const output = checkData?.data?.result || checkData?.data?.output || checkData?.result || checkData?.output || checkData?.data?.url || checkData?.data?.images || checkData?.data;
        const firstData = Array.isArray(output)
          ? output[0]
          : output?.data?.[0] || output?.[0] || output;

        let finalImageUrl = '';

        // Direct Kie.ai response resultUrls extraction
        if (checkData?.data?.response?.resultUrls?.[0]) {
          finalImageUrl = checkData.data.response.resultUrls[0];
        } else if (checkData?.response?.resultUrls?.[0]) {
          finalImageUrl = checkData.response.resultUrls[0];
        } else if (checkData?.data?.resultUrls?.[0]) {
          finalImageUrl = checkData.data.resultUrls[0];
        } else if (typeof checkData?.data?.resultJson === 'string') {
          try {
            const parsedRj = JSON.parse(checkData.data.resultJson);
            if (parsedRj?.resultUrls?.[0]) {
              finalImageUrl = parsedRj.resultUrls[0];
            }
          } catch { }
        }

        if (!finalImageUrl) {
          if (output?.image_url) {
            finalImageUrl = output.image_url;
          } else if (output?.image_base64) {
            finalImageUrl = output.image_base64.startsWith('data:')
              ? output.image_base64
              : `data:image/png;base64,${output.image_base64}`;
          } else if (firstData?.b64_json) {
            finalImageUrl = `data:image/png;base64,${firstData.b64_json}`;
          } else if (firstData?.url) {
            finalImageUrl = firstData.url;
          } else if (typeof firstData === 'string' && (firstData.startsWith('http') || firstData.startsWith('data:image'))) {
            finalImageUrl = firstData;
          } else if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:image'))) {
            finalImageUrl = output;
          } else if (output?.image_urls?.[0]) {
            finalImageUrl = typeof output.image_urls[0] === 'string' ? output.image_urls[0] : output.image_urls[0].url;
          } else if (output?.images?.[0]) {
            finalImageUrl = typeof output.images[0] === 'string' ? output.images[0] : output.images[0].url;
          }
        }

        if (!finalImageUrl) {
          // Aggressive fallback: search entire data object for an image URL, avoiding input URLs
          const dataStr = JSON.stringify(checkData.data || checkData);
          const matches = dataStr.matchAll(/"(https?:\/\/[^"]+)"/g);
          for (const match of matches) {
            const url = match[1];
            if (url && !url.includes('ibb.co') && !url.includes('imgbb.com')) {
              finalImageUrl = url;
              break;
            }
          }
        }

        if (finalImageUrl) {
          // Strictly strip any trailing backslashes, escape chars, or whitespace
          finalImageUrl = finalImageUrl.trim().replace(/[\\'";,\s]+$/, '');
        }

        if (finalImageUrl) {
          console.log(`[Kie.ai] Photoshoot generation completed successfully! Task ID: ${taskId}`);
          console.log(`✅ [Kie.ai] Final Extracted Image URL:`, finalImageUrl);

          // Upscaling removed as per user request

          // Upload to Cloudflare R2 for permanent storage
          let permanentUrl = finalImageUrl;
          if (isStorageConfigured()) {
            try {
              const uId = userId || 'customer';
              const oId = orderId || 'order';
              const pId = poseId || taskId;
              permanentUrl = await uploadGeneratedAsset(finalImageUrl, uId, oId, pId);
            } catch (cloudErr) {
              console.warn('[Storage] Failed to upload generated asset, falling back to direct URL:', cloudErr);
            }
          }

          // Auto-save to DB
          await saveGeneratedOrder({
            userId,
            templateId,
            orderId,
            poseId,
            permanentUrl,
            prompt: cleanPrompt,
            productName,
            stockCode,
            description,
            uploadedImages,
            selectedModelId,
            selectedOptions,
          });

          return NextResponse.json({
            imageUrl: permanentUrl,
            provider: 'kie-ai',
            taskId,
          });
        } else {
          const errMsg = `Kie.ai completed but no image data was found in output: ${JSON.stringify(checkData.data || output)}`;
          console.error('[Kie.ai Error]', errMsg);
          return NextResponse.json(
            { error: errMsg, taskId },
            { status: 500 }
          );
        }
      }

      if (status === 'failed' || status === 'error') {
        const rawErr = checkData?.data?.error;
        const errBody = checkData?.data?.output?.error_body?.error;

        let failReason =
          errBody?.message ||
          rawErr?.raw_message ||
          rawErr?.message ||
          rawErr?.detail ||
          checkData?.data?.message ||
          'Unknown error during Gemini processing';

        const isQuotaOrChannelErr =
          errBody?.code === 'insufficient_user_quota' ||
          failReason.includes('用户额度不足') ||
          failReason.includes('insufficient_user_quota') ||
          failReason.includes('No available channel') ||
          failReason.includes('distributor') ||
          failReason.includes('403');

        if (isQuotaOrChannelErr) {
          return NextResponse.json(
            {
              error:
                '⚠️ Kie.ai Credit Balance Exhausted: Your account credits have reached 0. Please top up your Kie.ai account.',
              needsCredits: true,
              taskId,
            },
            { status: 402 }
          );
        }

        console.error(`[Kie.ai] Task failed with error: ${failReason}`);
        return NextResponse.json({ error: `AI Generation Error: ${failReason}`, taskId }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        error: 'Task is processing in the background on Kie.ai. Recovering image...',
        taskId,
        provider: 'kie-ai',
        isProcessing: true,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[API /generate] Internal Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

// Helper: Auto-save order and generated image to Postgres
async function saveGeneratedOrder(params: {
  userId: string;
  templateId?: string;
  orderId?: string;
  poseId?: string;
  permanentUrl: string;
  prompt: string;
  productName?: string;
  stockCode?: string;
  description?: string;
  uploadedImages?: any;
  selectedModelId?: string;
  selectedOptions?: any;
}) {
  const {
    userId,
    templateId,
    orderId,
    poseId,
    permanentUrl,
    prompt,
    productName,
    stockCode,
    description,
    uploadedImages,
    selectedModelId,
    selectedOptions,
  } = params;

  if (userId && userId !== 'anonymous_user' && templateId) {
    try {
      const activeOrderId = orderId || `order_${Date.now()}`;
      const existingOrder = await prisma.customerOrder.findUnique({
        where: { id: activeOrderId },
      });

      const existingGenImages = (existingOrder?.generatedImages as any) || {};
      const currentPoseKey = poseId || `pose_${Date.now()}`;
      const updatedGenImages = {
        ...existingGenImages,
        [currentPoseKey]: {
          imageUrl: permanentUrl,
          prompt,
          generatedAt: new Date().toISOString(),
        },
      };

      if (existingOrder) {
        await prisma.customerOrder.update({
          where: { id: activeOrderId },
          data: {
            generatedImages: updatedGenImages,
            uploadedImages: uploadedImages || existingOrder.uploadedImages,
            productName: productName || existingOrder.productName,
            status: 'completed',
          },
        });
        console.log(`[DB AutoSave] Updated CustomerOrder ${activeOrderId} with pose ${currentPoseKey}`);
        
        // Auto-link to Product inventory
        if (stockCode) {
          const product = await prisma.product.findFirst({
            where: { OR: [{ stockCode }, { friendlyCode: stockCode }] },
          });
          if (product) {
            const firstImage = Object.values(updatedGenImages as Record<string, {imageUrl: string}>)[0];
            await prisma.product.update({
              where: { id: product.id },
              data: {
                generatedImages: updatedGenImages as any,
                linkedOrderId: activeOrderId,
                coverImageUrl: firstImage?.imageUrl || product.coverImageUrl,
              },
            });
            console.log(`[DB AutoSave] Synced CustomerOrder ${activeOrderId} to Product ${product.id}`);
          }
        }
      } else {
        await prisma.customerOrder.create({
          data: {
            id: activeOrderId,
            userId,
            templateId,
            productName: productName || 'Garment Photoshoot',
            stockCode: stockCode || null,
            description: description || null,
            uploadedImages: uploadedImages || null,
            selectedModelId: selectedModelId || null,
            selectedOptions: selectedOptions || null,
            generatedImages: updatedGenImages,
            status: 'completed',
          },
        });
        console.log(`[DB AutoSave] Created CustomerOrder ${activeOrderId} with pose ${currentPoseKey}`);
        
        // Auto-link to Product inventory
        if (stockCode) {
          const product = await prisma.product.findFirst({
            where: { OR: [{ stockCode }, { friendlyCode: stockCode }] },
          });
          if (product) {
            const firstImage = Object.values(updatedGenImages as Record<string, {imageUrl: string}>)[0];
            await prisma.product.update({
              where: { id: product.id },
              data: {
                generatedImages: updatedGenImages as any,
                linkedOrderId: activeOrderId,
                coverImageUrl: firstImage?.imageUrl || product.coverImageUrl,
              },
            });
            console.log(`[DB AutoSave] Synced CustomerOrder ${activeOrderId} to Product ${product.id}`);
          }
        }
      }
    } catch (dbErr) {
      console.error('[DB AutoSave Error]:', dbErr);
    }
  }
}
