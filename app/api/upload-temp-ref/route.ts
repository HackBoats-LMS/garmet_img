import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/upload-temp-ref
// Uploads input swatches directly to Kie.ai's native temporary file storage (auto-deleted by Kie.ai)
// or Cloudflare R2 temporary storage as robust fallback.
// Guarantees generation payloads are tiny (<100 bytes) instead of 10-15MB base64, eliminating HTTP 413.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit('api:upload-temp-ref', ip, { windowMs: 60 * 1000, max: 120 });
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many upload requests. Please wait a moment.' }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file } = body; // Base64 data URL

    if (!file || typeof file !== 'string') {
      return NextResponse.json({ error: 'Invalid file provided' }, { status: 400 });
    }

    if (file.startsWith('http://') || file.startsWith('https://')) {
      return NextResponse.json({ url: file });
    }

    const cleanBase64 = file.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = file.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimeType.split('/')[1] || 'jpg';
    const buffer = Buffer.from(cleanBase64, 'base64');

    const rawKieKey = (
      process.env.KIE_API_KEY ||
      process.env.PIAPI_API_KEY ||
      process.env.NEXT_PUBLIC_KIE_API_KEY ||
      ''
    ).trim();
    const kieApiKey = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (kieApiKey) {
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: mimeType }), `ref_${Date.now()}.${ext}`);
      formData.append('uploadPath', 'images/temp-inputs');
      formData.append('fileName', `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);

      try {
        const res = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${kieApiKey}`,
          },
          body: formData,
        });

        if (res.ok) {
          const resData = await res.json();
          const downloadUrl = resData?.data?.downloadUrl || resData?.downloadUrl;
          if (downloadUrl) {
            return NextResponse.json({ url: downloadUrl });
          }
        }
      } catch (kieErr: any) {
        console.warn('[upload-temp-ref] Kie native upload failed:', kieErr?.message);
      }

      // Secondary Kie fallback endpoint
      try {
        const fallbackRes = await fetch('https://api.kie.ai/api/file-stream-upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${kieApiKey}`,
          },
          body: formData,
        });

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          const fbUrl = fbData?.data?.downloadUrl || fbData?.downloadUrl;
          if (fbUrl) {
            return NextResponse.json({ url: fbUrl });
          }
        }
      } catch (kieFallbackErr: any) {
        console.warn('[upload-temp-ref] Kie secondary upload failed:', kieFallbackErr?.message);
      }
    }

    // Fallback: Cloudflare R2 Temporary Storage
    if (isStorageConfigured()) {
      try {
        const uploaded = await uploadToStorage(file, {
          folder: 'temp-reference-inputs',
          publicId: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        });
        if (uploaded?.url) {
          return NextResponse.json({ url: uploaded.url });
        }
      } catch (r2Err: any) {
        console.warn('[upload-temp-ref] R2 fallback upload failed:', r2Err?.message);
      }
    }

    return NextResponse.json({ error: 'Failed to upload temporary reference image' }, { status: 502 });
  } catch (error: any) {
    console.error('[API /upload-temp-ref Error]:', error);
    return NextResponse.json({ error: error?.message || 'Internal upload error' }, { status: 500 });
  }
}
