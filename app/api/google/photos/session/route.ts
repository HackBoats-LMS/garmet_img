import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

// POST /api/google/photos/session — creates a new PickingSession
export async function POST(req: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const body = await req.json();
    const token = body.token || (session?.user as any)?.accessToken;

    if (!token) {
      return NextResponse.json({ error: 'Google OAuth access token is required' }, { status: 400 });
    }

    const res = await fetch(`${PICKER_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error?.message || res.statusText;
      console.error('[Google Photos Session Create Error]:', data);
      return NextResponse.json(
        {
          error: `Google Photos Picker API error: ${errorMsg}`,
          details: data?.error,
        },
        { status: res.status }
      );
    }

    console.log('[Google Photos Session] Created session:', data.id);
    return NextResponse.json({
      success: true,
      sessionId: data.id,
      pickerUri: data.pickerUri,
      pollingConfig: data.pollingConfig,
    });
  } catch (error: any) {
    console.error('[Google Photos Session Create Exception]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// GET /api/google/photos/session?sessionId=...&token=... — polls session and fetches items when done
export async function GET(req: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const { searchParams } = req.nextUrl;
    const sessionId = searchParams.get('sessionId');
    const token = searchParams.get('token') || (session?.user as any)?.accessToken;

    if (!sessionId || !token) {
      return NextResponse.json({ error: 'sessionId and token are required' }, { status: 400 });
    }

    // 1. Check session status
    const sessionRes = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!sessionRes.ok) {
      if (sessionRes.status === 404) {
        // Session was already consumed and cleaned up, or expired
        return NextResponse.json({
          mediaItemsSet: false,
          status: 'EXPIRED_OR_COMPLETED',
          completed: true,
        });
      }
      const errData = await sessionRes.json().catch(() => ({}));
      console.warn('[Google Photos Poll] Session status check failed:', sessionRes.status, errData);
      return NextResponse.json(
        { error: errData?.error?.message || 'Failed to check session' },
        { status: sessionRes.status }
      );
    }

    const sessionData = await sessionRes.json();
    console.log('[Google Photos Poll] Session:', sessionId, 'mediaItemsSet:', sessionData.mediaItemsSet);

    // If user has not finished selecting yet
    if (!sessionData.mediaItemsSet) {
      return NextResponse.json({
        mediaItemsSet: false,
        status: 'PENDING',
      });
    }

    // 2. Fetch selected media items
    const itemsRes = await fetch(`${PICKER_API_BASE}/mediaItems?sessionId=${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!itemsRes.ok) {
      const errData = await itemsRes.json().catch(() => ({}));
      console.error('[Google Photos Poll] mediaItems fetch failed:', itemsRes.status, errData);
      return NextResponse.json(
        { error: errData?.error?.message || 'Failed to fetch picked media items' },
        { status: itemsRes.status }
      );
    }

    const itemsData = await itemsRes.json();
    const rawItems: any[] = itemsData.mediaItems || [];
    console.log('[Google Photos Poll] User clicked Done! Picked rawItems count:', rawItems.length);

    if (rawItems.length > 0) {
      console.log('[Google Photos Poll] Item structure keys:', Object.keys(rawItems[0]));
    }

    // 3. Download images in parallel with optimized size (=w1600) to keep total payload safely below 4MB
    const downloadPromises = rawItems.map(async (item: any, idx: number) => {
      // Support baseUrl either directly on item or nested under mediaFile
      const baseUrl = item.baseUrl || item.mediaFile?.baseUrl;
      const mime = item.mimeType || item.mediaFile?.mimeType || 'image/jpeg';
      const filename = item.filename || item.mediaFile?.filename || `google_photo_${Date.now()}_${idx + 1}.jpg`;

      if (!baseUrl) {
        console.warn(`[Google Photos] Item ${idx + 1} has no baseUrl. Item keys:`, Object.keys(item));
        return null;
      }

      // Helper to fetch with Bearer token, falling back to direct fetch if rejected
      const fetchBuffer = async (url: string) => {
        try {
          let res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) return res;
          // Fallback: try without Authorization header (for pre-signed URLs)
          res = await fetch(url);
          if (res.ok) return res;
        } catch (e) {
          console.warn(`[Google Photos] Fetch exception for item ${idx + 1}:`, e);
        }
        return null;
      };

      try {
        // Try optimized web dimension =w1600 (~150-250KB each)
        let imgRes = await fetchBuffer(`${baseUrl}=w1600`);

        // Fallback to original =d
        if (!imgRes) {
          imgRes = await fetchBuffer(`${baseUrl}=d`);
        }

        // Fallback to raw baseUrl
        if (!imgRes) {
          imgRes = await fetchBuffer(baseUrl);
        }

        if (imgRes && imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const finalMime = imgRes.headers.get('content-type') || mime;
          const base64 = `data:${finalMime};base64,${buffer.toString('base64')}`;
          return {
            filename,
            mimeType: finalMime,
            base64,
          };
        } else {
          console.error(`[Google Photos] Failed to download item ${idx + 1} (${filename})`);
        }
      } catch (err) {
        console.error(`[Google Photos] Exception downloading item ${idx + 1}:`, err);
      }
      return null;
    });

    const results = await Promise.all(downloadPromises);
    const processedItems = results.filter(Boolean);
    console.log('[Google Photos Poll] Successfully processed items:', processedItems.length, 'of', rawItems.length);

    // 4. Clean up session on Google backend
    try {
      await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {
      // Best-effort cleanup
    }

    return NextResponse.json({
      mediaItemsSet: true,
      status: 'COMPLETED',
      totalPicked: processedItems.length,
      items: processedItems,
    });
  } catch (error: any) {
    console.error('[Google Photos Session Poll Exception]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
