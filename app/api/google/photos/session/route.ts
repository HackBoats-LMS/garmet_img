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

    const payload: any = {};
    if (body.maxItems && typeof body.maxItems === 'number' && body.maxItems > 0) {
      payload.pickingConfig = {
        maxItemCount: String(Math.min(body.maxItems, 2000)),
      };
    }

    const res = await fetch(`${PICKER_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

// GET /api/google/photos/session?sessionId=...&token=... — polls session and fetches items metadata when user completes selection
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

    // 2. Fetch selected media items metadata (up to 100 items)
    const itemsRes = await fetch(`${PICKER_API_BASE}/mediaItems?sessionId=${sessionId}&pageSize=100`, {
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

    // Return lightweight item references so that Vercel's 4.5MB response limit is never breached
    const items = rawItems.map((item: any, idx: number) => ({
      id: item.id || `photo_${idx}`,
      filename: item.mediaFile?.filename || `google_photo_${idx + 1}.jpg`,
      mimeType: item.mediaFile?.mimeType || 'image/jpeg',
      baseUrl: item.mediaFile?.baseUrl || '',
    }));

    return NextResponse.json({
      mediaItemsSet: true,
      status: 'COMPLETED',
      totalPicked: items.length,
      items,
    });
  } catch (error: any) {
    console.error('[Google Photos Session Poll Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/google/photos/session?sessionId=...&token=... — cleans up session after client downloads items
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const { searchParams } = req.nextUrl;
    const sessionId = searchParams.get('sessionId');
    const token = searchParams.get('token') || (session?.user as any)?.accessToken;

    if (!sessionId || !token) {
      return NextResponse.json({ error: 'sessionId and token are required' }, { status: 400 });
    }

    await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
