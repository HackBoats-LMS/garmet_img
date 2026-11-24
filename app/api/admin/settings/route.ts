import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllSettingsForAdmin, setSetting, KNOWN_SETTINGS, invalidateSettingCache } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/settings
 * Returns all system settings with sensitive secrets masked.
 */
export async function GET() {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getAllSettingsForAdmin();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error: any) {
    console.error('[GET /api/admin/settings error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings
 * Updates one or more settings with bank-grade encryption at rest.
 * Body: { key: string, value: string } OR { updates: Record<string, string> }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, string> = body.updates || (body.key ? { [body.key]: body.value } : {});

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No settings provided to update' }, { status: 400 });
    }

    // Build lookup map for known setting definitions
    const defMap = new Map(KNOWN_SETTINGS.map((d) => [d.key, d]));

    const savedKeys: string[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (typeof val !== 'string') continue;

      // Do not overwrite if user kept the masked placeholder
      if (val.includes('••••')) {
        continue;
      }

      const trimmedVal = val.trim();
      const def = defMap.get(key);

      const isSecret = def ? def.isSecret : true;
      const category = def ? def.category : 'general';
      const description = def ? def.description : undefined;

      await setSetting(key, trimmedVal, { isSecret, category, description });
      savedKeys.push(key);
    }

    // Invalidate cache for refreshed reads
    invalidateSettingCache();

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${savedKeys.length} setting(s).`,
      savedKeys,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/settings error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to save settings' }, { status: 500 });
  }
}
