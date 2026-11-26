import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listMergedHardcodedTemplates } from '@/lib/hardcoded-templates';

// GET /api/admin/templates — Return hardcoded templates (merged with DB active/model-pick flags)
export async function GET() {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await listMergedHardcodedTemplates();
    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/templates — Disabled (templates are hardcoded in lib/hardcoded-templates.ts)
export async function POST() {
  const session = await auth();
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        'Adding new templates from the Admin Panel is disabled. Templates are hardcoded in lib/hardcoded-templates.ts.',
    },
    { status: 403 }
  );
}
