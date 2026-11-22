import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSafeGooglePhotosUrl } from '@/lib/security';

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

    if (!session?.user && !token) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (!baseUrl || !isSafeGooglePhotosUrl(baseUrl)) {
      return NextResponse.json({ error: 'Valid Google Photos baseUrl is required' }, { status: 400 });
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

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/') && !contentType.toLowerCase().includes('octet-stream')) {
      return NextResponse.json({ error: 'Downloaded file is not a valid image' }, { status: 415 });
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      filename: body.filename || `google_photo_${Date.now()}.jpg`,
      mimeType: contentType,
      base64: dataUrl,
      url: dataUrl,
      contentType,
      size: arrayBuffer.byteLength,
    });
  } catch (error: any) {
    console.error('[Google Photos Download Exception]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to download image' },
      { status: 500 }
    );
  }
}
