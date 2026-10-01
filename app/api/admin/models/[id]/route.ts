import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import prisma from '@/lib/prisma';
import { uploadAdminModelAsset, isCloudinaryConfigured } from '@/lib/cloudinary';
import { auth } from '@/lib/auth';

// Helper to save base64 locally if Cloudinary is unavailable
function saveBase64Locally(base64Str: string, filenamePrefix: string): string {
  try {
    const matches = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) return base64Str;

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const modelsDir = path.join(process.cwd(), 'public', 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    const filename = `${filenamePrefix}_${Date.now()}.${ext}`;
    const filePath = path.join(modelsDir, filename);
    fs.writeFileSync(filePath, data);
    return `/models/${filename}`;
  } catch (err) {
    console.warn('[SaveBase64Locally Warning]:', err);
    return base64Str;
  }
}

// PUT /api/admin/models/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, tagline, imageUrl, skinTone, features, promptAnchor, isActive, sortOrder } = body;

    let finalImageUrl = imageUrl;
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
      if (isCloudinaryConfigured()) {
        try {
          finalImageUrl = await uploadAdminModelAsset(imageUrl, name || id);
        } catch (cErr) {
          console.warn('[Cloudinary Model Upload Error, saving locally]:', cErr);
          finalImageUrl = saveBase64Locally(imageUrl, `model_${id}`);
        }
      } else {
        finalImageUrl = saveBase64Locally(imageUrl, `model_${id}`);
      }
    }

    // Resilient DB Update (supports both Prisma Client and Raw SQL fallback)
    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (tagline !== undefined) updateData.tagline = tagline;
      if (finalImageUrl !== undefined) updateData.imageUrl = finalImageUrl;
      if (skinTone !== undefined) updateData.skinTone = skinTone;
      if (features !== undefined) updateData.features = features;
      if (promptAnchor !== undefined) updateData.promptAnchor = promptAnchor;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const model = await (prisma.aIModel || (prisma as any).aiModel).update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ model, success: true });
    } catch (prismaErr) {
      console.warn('[Prisma Model Update Fallback to Raw SQL]:', prismaErr);
      
      await prisma.$executeRawUnsafe(
        `
        UPDATE "AIModel"
        SET 
          "name" = COALESCE($1, "name"),
          "tagline" = COALESCE($2, "tagline"),
          "imageUrl" = COALESCE($3, "imageUrl"),
          "skinTone" = COALESCE($4, "skinTone"),
          "features" = COALESCE($5, "features"),
          "promptAnchor" = COALESCE($6, "promptAnchor"),
          "isActive" = COALESCE($7, "isActive"),
          "updatedAt" = NOW()
        WHERE "id" = $8;
        `,
        name ?? null,
        tagline ?? null,
        finalImageUrl ?? null,
        skinTone ?? null,
        features ?? null,
        promptAnchor ?? null,
        isActive ?? null,
        id
      );

      return NextResponse.json({ success: true, imageUrl: finalImageUrl });
    }
  } catch (error: any) {
    console.error('[Admin Models PUT Error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update model' }, { status: 500 });
  }
}

// DELETE /api/admin/models/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.aIModel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
