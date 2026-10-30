import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { auth } from '@/lib/auth';
import { uploadGeneratedAsset, uploadToStorage, isStorageConfigured } from '@/lib/storage';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
      console.warn('[API /generate-garment-ref] Failed to resolve public image path:', imgStr, e);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit('api:generate-garment-ref', ip, { windowMs: 60 * 1000, max: 20 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many generation requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const session = await auth();
    const body = await req.json();

    const {
      uploadedImages = {},
      sareeDesignType = '',
      presentationStyle = 'laid_flat',
      presentationView = 'front',
      sareeFabricType,
      palluSize = 'medium',
      borderWidth = 'medium',
      borderEdges,
      tassels = 'none',
      tasselColor = '',
      tasselLocation = 'pallu end',
      blouseRule = 'match_swatch',
      bodyDescription,
      palluDescription,
      borderDescription,
      aspectRatio = '3:4',
      userId: reqUserId,
      templateId,
      orderId,
    } = body;

    const userId = reqUserId || (session?.user as any)?.id || 'anonymous_user';

    const rawKieKey = (process.env.KIE_API_KEY || process.env.PIAPI_API_KEY || '').trim();
    const kieApiKeyBearer = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!kieApiKeyBearer) {
      return NextResponse.json(
        { error: 'KIE_API_KEY is not configured in .env.local file.', needsKey: true },
        { status: 401 }
      );
    }

    // 1. Order swatches strictly: Body, Pallu, Blouse (NO face images)
    const orderedSwatches: { dataUrl: string; label: string }[] = [];
    const keys = Object.keys(uploadedImages);

    // Body
    const bodyKey = keys.find(k => k.toLowerCase().includes('body') || k.toLowerCase().includes('garment') || k.toLowerCase().includes('view')) || keys[0];
    if (bodyKey && uploadedImages[bodyKey]) {
      const resolved = resolveImageToDataUrl(uploadedImages[bodyKey]);
      if (resolved) orderedSwatches.push({ dataUrl: resolved, label: 'saree body fabric' });
    }

    // Pallu
    const palluKey = keys.find(k => k !== bodyKey && (k.toLowerCase().includes('pallu') || k.toLowerCase().includes('border'))) || (keys.length > 1 ? keys[1] : null);
    if (palluKey && uploadedImages[palluKey]) {
      const resolved = resolveImageToDataUrl(uploadedImages[palluKey]);
      if (resolved) orderedSwatches.push({ dataUrl: resolved, label: 'pallu and border' });
    }

    // Blouse
    const blouseKey = keys.find(k => k !== bodyKey && k !== palluKey && k.toLowerCase().includes('blouse')) || (keys.length > 2 ? keys[2] : null);
    if (blouseKey && uploadedImages[blouseKey]) {
      const resolved = resolveImageToDataUrl(uploadedImages[blouseKey]);
      if (resolved) orderedSwatches.push({ dataUrl: resolved, label: 'blouse fabric' });
    }

    if (orderedSwatches.length === 0) {
      return NextResponse.json(
        { error: 'Please upload at least one fabric swatch to generate a garment reference.' },
        { status: 400 }
      );
    }

    // 2. Upload swatches to temporary hosting
    const uploadToKie = async (base64Data: string): Promise<string> => {
      try {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';
        const buffer = Buffer.from(cleanBase64, 'base64');

        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimeType }), `ref_${Date.now()}.${ext}`);
        formData.append('uploadPath', 'images/user-uploads');
        formData.append('fileName', `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);

        const res = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${kieApiKeyBearer}` },
          body: formData,
        });

        if (res.ok) {
          const resData = await res.json();
          const downloadUrl = resData?.data?.downloadUrl || resData?.downloadUrl;
          if (downloadUrl) return downloadUrl;
        }
      } catch (e: any) {
        console.warn('[Garment Ref] Kie.ai native upload failed, falling back to R2...', e?.message);
      }

      if (isStorageConfigured()) {
        try {
          const uploaded = await uploadToStorage(base64Data, {
            folder: 'temp-reference-inputs',
            publicId: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          });
          if (uploaded.url) return uploaded.url;
        } catch (r2Err: any) {
          console.warn('[Garment Ref] R2 fallback failed:', r2Err?.message);
        }
      }

      throw new Error('Failed to upload swatch to temporary hosting.');
    };

    const inputUrls: string[] = [];
    for (const swatch of orderedSwatches) {
      const url = await uploadToKie(swatch.dataUrl);
      inputUrls.push(url);
    }

    // 3. Assemble clean natural language prompt for Stage 1
    const imageMapLines = orderedSwatches.map((s, idx) => `Image ${idx + 1}: ${s.label}.`);

    const sareeLines: string[] = [];
    if (sareeFabricType && sareeFabricType.trim()) {
      sareeLines.push(`- Fabric: ${sareeFabricType.trim()}`);
    }
    if (bodyDescription && bodyDescription.trim()) {
      sareeLines.push(`- Body: ${bodyDescription.trim()}`);
    }

    const defaultBorderEdges = sareeDesignType === 'contrast_pallu'
      ? 'along the lower hem and outer edge of the chest wrap and pallu'
      : 'along the hem and outer pallu edge';
    const activeBorderEdges = borderEdges && borderEdges.trim() ? borderEdges.trim() : defaultBorderEdges;

    const borderDescText = borderDescription && borderDescription.trim() ? `${borderDescription.trim()}, ` : '';
    sareeLines.push(`- Border: ${borderDescText}${borderWidth} border, running ${activeBorderEdges}`);

    const palluRatio = palluSize === 'small' ? '1/4' : palluSize === 'large' ? '1/2' : '1/3';
    const palluDescText = palluDescription && palluDescription.trim() ? `${palluDescription.trim()}, ` : '';
    sareeLines.push(`- Pallu: ${palluDescText}covering about ${palluRatio} of the saree length`);

    let blouseText = 'fitted tailored blouse matching the blouse swatch reference';
    if (blouseRule === 'plain_contrast') blouseText = 'plain contrast tailored blouse complementing the saree border';
    else if (blouseRule === 'same_as_body') blouseText = 'tailored blouse crafted from the same fabric as the saree body';
    sareeLines.push(`- Blouse: ${blouseText}`);

    let endsText = 'Hem and pallu end are plain, flat, finished edges.';
    if (tassels !== 'none') {
      const col = tasselColor && tasselColor.trim() ? `${tasselColor.trim()} ` : '';
      endsText = `Tassels (${col}matching) hang only along ${tasselLocation || 'pallu end'}, as in the reference.`;
    }
    sareeLines.push(`- Ends: ${endsText}`);

    let drapeRule = '';
    if (sareeDesignType === 'contrast_pallu') {
      drapeRule = 'Body fabric covers the skirt, front pleats and the chest wrap. The border runs along the outer edge of the chest wrap only. From the waist down, the hanging pallu shows the pallu artwork.';
    } else if (sareeDesignType === 'half_half') {
      drapeRule = 'Lower half from waist to hem uses the body fabric and pleats. Upper half across chest drape and shoulder uses the contrast fabric with a clean horizontal boundary at the waist.';
    } else {
      drapeRule = 'Body fabric motifs continue across the skirt, waist pleats, and chest wrap in a continuous traditional drape.';
    }

    const styleText = presentationStyle === 'dress_form'
      ? 'elegantly draped on a plain headless neutral mannequin dress form'
      : 'neatly laid flat and spread';
    const viewText = presentationView === 'rear'
      ? 'from the rear angle, clearly displaying the full pallu end-piece and hanging fall'
      : 'from the front angle, showing body, border, and pallu in proper proportion';

    const stage1Prompt = `Professional catalogue product photograph of the complete saree displayed ${styleText} ${viewText} against a plain neutral light-gray background, studio lighting.

Reference images, in order:
${imageMapLines.join(' ')}

Saree structure (copy exactly from the references; do not simplify or invent motifs):
${sareeLines.join('\n')}
${drapeRule}

Clean catalog product presentation, true colors, crisp fabric weave and motif clarity. No human model, no face, no text, no logos.`;

    console.log('[API /generate-garment-ref] Prompt:', stage1Prompt);
    console.log('[API /generate-garment-ref] Input URLs:', inputUrls);

    // 4. Submit to Kie.ai nano-banana-2-1
    const kiePayload = {
      model: 'nano-banana-2-1',
      input: {
        prompt: stage1Prompt,
        aspect_ratio: aspectRatio || '3:4',
        resolution: '2K',
        nsfw_checker: false,
        image_input: inputUrls,
        output_format: 'png',
      },
    };

    const endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
    const submitRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieApiKeyBearer}`,
      },
      body: JSON.stringify(kiePayload),
    });

    const submitText = await submitRes.text();
    if (!submitRes.ok) {
      return NextResponse.json(
        { error: `Kie.ai Error (${submitRes.status}): ${submitText}` },
        { status: submitRes.status }
      );
    }

    let submitData: any = {};
    try {
      submitData = JSON.parse(submitText);
    } catch {
      return NextResponse.json({ error: `Non-JSON response from Kie.ai: ${submitText}` }, { status: 500 });
    }

    const taskId = submitData?.data?.taskId || submitData?.data?.id || submitData?.task_id;
    if (!taskId) {
      return NextResponse.json({ error: `No task ID in Kie.ai response: ${submitText}` }, { status: 500 });
    }

    // 5. Poll task
    for (let attempt = 1; attempt <= 70; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const checkRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { 'Authorization': `Bearer ${kieApiKeyBearer}` },
      });

      if (!checkRes.ok) continue;
      const checkData = await checkRes.json().catch(() => null);
      if (!checkData) continue;

      const status = checkData?.data?.state || checkData?.state || checkData?.data?.status;
      if (status === 'fail' || status === 'failed' || status === 'error') {
        return NextResponse.json(
          { error: `Garment reference generation failed: ${checkData?.data?.error || checkData?.msg || 'Error'}` },
          { status: 500 }
        );
      }

      if (status === 'completed' || status === 'success') {
        let finalImageUrl = checkData?.data?.response?.resultUrls?.[0] || checkData?.data?.resultUrls?.[0];
        if (!finalImageUrl && checkData?.data?.result) {
          const r = checkData.data.result;
          finalImageUrl = Array.isArray(r) ? r[0] : (r?.url || r?.image_url || r);
        }

        if (finalImageUrl && typeof finalImageUrl === 'string') {
          finalImageUrl = finalImageUrl.trim();
          let permanentUrl = finalImageUrl;
          if (isStorageConfigured()) {
            try {
              permanentUrl = await uploadGeneratedAsset(finalImageUrl, userId, orderId || 'garment_ref', `garment_ref_${presentationView}`);
            } catch (storageErr) {
              console.warn('[Garment Ref] Storage upload warning:', storageErr);
            }
          }

          return NextResponse.json({
            imageUrl: permanentUrl,
            prompt: stage1Prompt,
            orderedImageList: inputUrls,
            taskId,
            presentationView,
          });
        }
      }
    }

    return NextResponse.json(
      { error: 'Garment reference generation timed out on Kie.ai. Please try again.', taskId },
      { status: 504 }
    );
  } catch (error: any) {
    console.error('[API /generate-garment-ref] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
