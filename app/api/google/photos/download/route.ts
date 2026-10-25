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

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    // Resilient fetch helper: tries with Bearer token, then falls back to direct fetch
    const fetchImageWithFallback = async (url: string) => {
      if (token) {
        try {
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (res.ok) return res;
        } catch (e) {
          console.warn('[Google Photos Download] Token fetch error:', e);
        }
      }

      try {
        const directRes = await fetch(url);
        if (directRes.ok) return directRes;
      } catch (e) {
        console.warn('[Google Photos Download] Direct fetch error:', e);
      }

      return null;
    };

    // 1. Try dimension-scaled image (optimized 2048px for fast download and clean payload)
    let imgRes = await fetchImageWithFallback(`${baseUrl}=w${maxDimension}-h${maxDimension}`);

    // 2. If dimension scaling fails, fallback to =d (original download)
    if (!imgRes) {
      console.warn(`[Google Photos Download] Dimension fetch failed, attempting fallback =d`);
      imgRes = await fetchImageWithFallback(`${baseUrl}=d`);
    }

    // 3. If still fails, try raw baseUrl
    if (!imgRes) {
      imgRes = await fetchImageWithFallback(baseUrl);
    }

    if (!imgRes || !imgRes.ok) {
      return NextResponse.json(
        { error: 'Failed to download image from Google Photos' },
        { status: 502 }
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
