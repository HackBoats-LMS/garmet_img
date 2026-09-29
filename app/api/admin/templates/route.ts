import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/templates — List all templates
export async function GET() {
  try {
    const templates = await prisma.garmentTemplate.findMany({
      include: {
        imageSlots: { orderBy: { sortOrder: 'asc' } },
        customOptions: { orderBy: { sortOrder: 'asc' } },
        poses: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { orders: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/templates — Create a new template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      slug,
      tagline,
      coverImage,
      description,
      garmentType,
      systemPrompt,
      negativePrompt,
      cameraSettings,
      allowModelSelection,
      defaultModelId,
      allowedModelIds,
      imageSlots,
      customOptions,
      poses,
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await prisma.garmentTemplate.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
    }

    const template = await prisma.garmentTemplate.create({
      data: {
        name,
        slug,
        tagline: tagline || null,
        coverImage: coverImage || null,
        description: description || null,
        garmentType: garmentType || null,
        systemPrompt: systemPrompt || null,
        negativePrompt: negativePrompt || null,
        cameraSettings: cameraSettings || null,
        allowModelSelection: allowModelSelection ?? true,
        defaultModelId: defaultModelId || null,
        allowedModelIds: allowedModelIds || null,
        imageSlots: {
          create: (imageSlots || []).map((slot: any, i: number) => ({
            name: slot.name,
            description: slot.description || null,
            sortOrder: slot.sortOrder ?? i,
            isRequired: slot.isRequired ?? true,
            sampleImageUrl: slot.sampleImageUrl || null,
          })),
        },
        customOptions: {
          create: (customOptions || []).map((opt: any, i: number) => ({
            label: opt.label,
            optionType: opt.optionType || 'radio',
            choices: opt.choices || [],
            sortOrder: opt.sortOrder ?? i,
          })),
        },
        poses: {
          create: (poses || []).map((pose: any, i: number) => ({
            name: pose.name,
            description: pose.description || null,
            promptSnippet: pose.promptSnippet || '',
            purpose: pose.purpose || null,
            fabricFocus: pose.fabricFocus || null,
            previewImage: pose.previewImage || null,
            category: pose.category || 'standing',
            sortOrder: pose.sortOrder ?? i,
          })),
        },
      },
      include: {
        imageSlots: true,
        customOptions: true,
        poses: true,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Templates POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
