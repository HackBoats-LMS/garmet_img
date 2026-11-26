import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getMergedHardcodedTemplate, resolveOrEnsureTemplateDbId } from '@/lib/hardcoded-templates';

// GET /api/admin/templates/[id] — Read hardcoded template definition
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const template = await getMergedHardcodedTemplate(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/templates/[id] — Only allows status & customer model-pick toggles; structural edits are locked
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { isActive, allowModelSelection, ...rest } = body;

    // Reject structural modifications (slots, options, poses, prompts, etc.)
    const disallowedKeys = Object.keys(rest).filter((k) => rest[k] !== undefined);
    if (disallowedKeys.length > 0 && isActive === undefined && allowModelSelection === undefined) {
      return NextResponse.json(
        {
          error:
            'Template structure is hardcoded in lib/hardcoded-templates.ts and cannot be modified from the Admin Panel.',
        },
        { status: 403 }
      );
    }

    const updateData: Record<string, boolean> = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (typeof allowModelSelection === 'boolean') updateData.allowModelSelection = allowModelSelection;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Only isActive and allowModelSelection toggles can be updated.' },
        { status: 400 }
      );
    }

    const dbId = await resolveOrEnsureTemplateDbId(id);
    await prisma.garmentTemplate.update({
      where: { id: dbId },
      data: updateData,
    });

    const template = await getMergedHardcodedTemplate(dbId);
    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('[Admin Template PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/templates/[id] — Disabled (templates are hardcoded)
export async function DELETE() {
  const session = await auth();
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        'Deleting templates from the Admin Panel is disabled. Templates are hardcoded in lib/hardcoded-templates.ts.',
    },
    { status: 403 }
  );
}
