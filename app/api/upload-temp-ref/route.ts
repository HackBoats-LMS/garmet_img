import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/upload-temp-ref
// Uploads input swatches directly to Kie.ai's native temporary file storage (auto-deleted by Kie.ai).
// Never saves input swatches to Cloudflare R2 or PostgreSQL database!
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

    const kieApiKey =
      process.env.KIE_API_KEY ||
      process.env.NEXT_PUBLIC_KIE_API_KEY ||
      '';

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), `ref_${Date.now()}.${ext}`);
    formData.append('uploadPath', 'images/temp-inputs');
    formData.append('fileName', `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);

    const res = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiKey.trim()}`,
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

    // Fallback: If Kie stream endpoint fails, try api.kie.ai endpoint
    const fallbackRes = await fetch('https://api.kie.ai/api/file-stream-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiKey.trim()}`,
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

    return NextResponse.json({ error: 'Failed to upload temporary reference to Kie.ai' }, { status: 502 });
  } catch (error: any) {
    console.error('[API /upload-temp-ref Error]:', error);
    return NextResponse.json({ error: error?.message || 'Internal upload error' }, { status: 500 });
  }
}
