import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/templates/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const template = await prisma.garmentTemplate.findUnique({
      where: { id },
      include: {
        imageSlots: { orderBy: { sortOrder: 'asc' } },
        customOptions: { orderBy: { sortOrder: 'asc' } },
        poses: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/templates/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      tagline,
      coverImage,
      description,
      garmentType,
      systemPrompt,
      negativePrompt,
      cameraSettings,
      isActive,
      allowModelSelection,
      defaultModelId,
      allowedModelIds,
      imageSlots,
      customOptions,
      poses,
    } = body;

    // Update main template fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (description !== undefined) updateData.description = description;
    if (garmentType !== undefined) updateData.garmentType = garmentType;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (negativePrompt !== undefined) updateData.negativePrompt = negativePrompt;
    if (cameraSettings !== undefined) updateData.cameraSettings = cameraSettings;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (allowModelSelection !== undefined) updateData.allowModelSelection = allowModelSelection;
    if (defaultModelId !== undefined) updateData.defaultModelId = defaultModelId;
    if (allowedModelIds !== undefined) updateData.allowedModelIds = allowedModelIds;

    // Update template
    const template = await prisma.garmentTemplate.update({
      where: { id },
      data: updateData,
    });

    // Replace image slots if provided
    if (imageSlots !== undefined) {
      await prisma.imageSlot.deleteMany({ where: { templateId: id } });
      if (imageSlots.length > 0) {
        await prisma.imageSlot.createMany({
          data: imageSlots.map((slot: any, i: number) => ({
            templateId: id,
            name: slot.name,
            description: slot.description || null,
            sortOrder: slot.sortOrder ?? i,
            isRequired: slot.isRequired ?? true,
            sampleImageUrl: slot.sampleImageUrl || null,
          })),
        });
      }
    }

    // Replace custom options if provided
    if (customOptions !== undefined) {
      await prisma.templateOption.deleteMany({ where: { templateId: id } });
      if (customOptions.length > 0) {
        await prisma.templateOption.createMany({
          data: customOptions.map((opt: any, i: number) => ({
            templateId: id,
            label: opt.label,
            optionType: opt.optionType || 'radio',
            choices: opt.choices || [],
            sortOrder: opt.sortOrder ?? i,
          })),
        });
      }
    }

    // Replace poses if provided
    if (poses !== undefined) {
      await prisma.poseTemplate.deleteMany({ where: { templateId: id } });
      if (poses.length > 0) {
        await prisma.poseTemplate.createMany({
          data: poses.map((pose: any, i: number) => ({
            templateId: id,
            name: pose.name,
            description: pose.description || null,
            promptSnippet: pose.promptSnippet || '',
            purpose: pose.purpose || null,
            fabricFocus: pose.fabricFocus || null,
            previewImage: pose.previewImage || null,
            category: pose.category || 'standing',
            sortOrder: pose.sortOrder ?? i,
          })),
        });
      }
    }

    // Return updated template
    const updated = await prisma.garmentTemplate.findUnique({
      where: { id },
      include: {
        imageSlots: { orderBy: { sortOrder: 'asc' } },
        customOptions: { orderBy: { sortOrder: 'asc' } },
        poses: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({ template: updated });
  } catch (error: any) {
    console.error('[Admin Template PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/templates/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.garmentTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
