import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PUT /api/admin/kie-models/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { displayName, modelId, isImageToImage, description, isActive, isDefault, sortOrder } = body;

    // If setting this as default, un-default all others first
    if (isDefault === true) {
      await prisma.$executeRawUnsafe(`UPDATE "KieModel" SET "isDefault" = false, "updatedAt" = NOW();`);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "KieModel" SET
        "displayName"    = COALESCE($1, "displayName"),
        "modelId"        = COALESCE($2, "modelId"),
        "isImageToImage" = COALESCE($3, "isImageToImage"),
        "description"    = COALESCE($4, "description"),
        "isActive"       = COALESCE($5, "isActive"),
        "isDefault"      = COALESCE($6, "isDefault"),
        "sortOrder"      = COALESCE($7, "sortOrder"),
        "updatedAt"      = NOW()
       WHERE "id" = $8;`,
      displayName ?? null,
      modelId ?? null,
      isImageToImage ?? null,
      description ?? null,
      isActive ?? null,
      isDefault ?? null,
      sortOrder ?? null,
      id
    );

    // If this is the new default, also update StudioConfig.selectedEngine
    if (isDefault === true && modelId) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "StudioConfig" SET "selectedEngine" = $1, "updatedAt" = NOW() WHERE "id" = 'global_studio_config';`,
          modelId
        );
      } catch (cfgErr) {
        console.warn('[KieModel PUT] Could not update StudioConfig selectedEngine:', cfgErr);
      }
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "KieModel" WHERE "id" = $1 LIMIT 1;`, id
    );

    return NextResponse.json({ model: rows[0], success: true });
  } catch (error: any) {
    console.error('[PUT /api/admin/kie-models/[id]]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/admin/kie-models/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.$executeRawUnsafe(`DELETE FROM "KieModel" WHERE "id" = $1;`, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/admin/kie-models/[id]]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
  }
}
