import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyStorageHealth } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// GET /api/admin/storage-health?force=true
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const force = req.nextUrl.searchParams.get('force') === 'true';
    const health = await verifyStorageHealth(force);
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'none',
        bucket: '',
        publicUrlConfigured: false,
        publicUrlReachable: null,
        missingEnvVars: [],
        error: error?.message || 'Storage health check failed',
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
