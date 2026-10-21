import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

// POST /api/google/photos/session — creates a new PickingSession
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const token = body.token || (session.user as any)?.accessToken;

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
      return NextResponse.json(
        {
          error: `Google Photos Picker API error: ${errorMsg}`,
          details: data?.error,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: data.id,
      pickerUri: data.pickerUri,
      pollingConfig: data.pollingConfig,
    });
  } catch (error: any) {
    console.error('[Google Photos Session Create Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// GET /api/google/photos/session?sessionId=...&token=... — polls session and fetches items when done
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const sessionId = searchParams.get('sessionId');
    const token = searchParams.get('token') || (session.user as any)?.accessToken;

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
      const errData = await sessionRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message || 'Failed to check session' },
        { status: sessionRes.status }
      );
    }

    const sessionData = await sessionRes.json();

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
      return NextResponse.json(
        { error: errData?.error?.message || 'Failed to fetch picked media items' },
        { status: itemsRes.status }
      );
    }

    const itemsData = await itemsRes.json();
    const rawItems = itemsData.mediaItems || [];

    // 3. Download image data as base64 for direct client usage
    const processedItems: { filename: string; mimeType: string; base64: string }[] = [];

    for (const item of rawItems) {
      if (item.mediaFile?.baseUrl) {
        try {
          // Append '=d' to request original download quality
          const downloadUrl = `${item.mediaFile.baseUrl}=d`;
          const imgFetch = await fetch(downloadUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (imgFetch.ok) {
            const arrayBuffer = await imgFetch.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mime = item.mediaFile.mimeType || imgFetch.headers.get('content-type') || 'image/jpeg';
            const base64 = `data:${mime};base64,${buffer.toString('base64')}`;
            processedItems.push({
              filename: item.mediaFile.filename || `google_photo_${Date.now()}.jpg`,
              mimeType: mime,
              base64,
            });
          }
        } catch (downloadErr) {
          console.warn('[Google Photos] Failed to download item:', downloadErr);
        }
      }
    }

    // 4. Clean up session
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
    console.error('[Google Photos Session Poll Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
