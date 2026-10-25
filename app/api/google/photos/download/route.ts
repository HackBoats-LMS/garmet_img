import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// POST /api/google/photos/download
// Downloads an individual photo from Google Photos using baseUrl with optimized dimensions,
// avoiding Vercel's 4.5MB serverless response limit and timeouts on bulk selection.
export async function POST(req: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const body = await req.json();
    const token = body.token || (session?.user as any)?.accessToken;
    const baseUrl = body.baseUrl;
    const maxDimension = body.maxDimension || 2048;

    if (!baseUrl || !token) {
      return NextResponse.json({ error: 'baseUrl and token are required' }, { status: 400 });
    }

    // Appending =w2048-h2048 requests a high-quality web-optimized image scaled down to 2048px max
    // directly from Google Photos CDN (~300KB-600KB instead of 25MB uncompressed camera raw).
    const downloadUrl = `${baseUrl}=w${maxDimension}-h${maxDimension}`;

    let imgRes = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // If dimension parameters fail, fallback to =d
    if (!imgRes.ok) {
      console.warn(`[Google Photos Download] Dimension fetch failed (${imgRes.status}), attempting fallback =d`);
      imgRes = await fetch(`${baseUrl}=d`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }

    if (!imgRes.ok) {
      const errText = await imgRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Google Photos fetch error (${imgRes.status}): ${errText}` },
        { status: imgRes.status }
      );
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = imgRes.headers.get('content-type') || body.mimeType || 'image/jpeg';
    const base64 = `data:${mime};base64,${buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      filename: body.filename || `google_photo_${Date.now()}.jpg`,
      mimeType: mime,
      base64,
    });
  } catch (error: any) {
    console.error('[Google Photos Download Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
