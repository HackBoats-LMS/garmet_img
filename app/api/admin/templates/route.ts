import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { uploadToStorage } from '@/lib/storage';

// GET /api/admin/templates — List all templates
export async function GET() {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    let finalCoverImage = coverImage;
    if (coverImage && coverImage.startsWith('data:image/')) {
      const uploaded = await uploadToStorage(coverImage, { 
        bucket: 'images',
        folder: 'templates', 
        publicId: `template_${slug}_cover_${Date.now()}`
      });
      finalCoverImage = uploaded.url;
    }

    let finalPoses = poses;
    if (poses && Array.isArray(poses)) {
      finalPoses = await Promise.all(poses.map(async (pose: any, i: number) => {
        let finalPreview = pose.previewImage;
        if (finalPreview && finalPreview.startsWith('data:image/')) {
          const uploaded = await uploadToStorage(finalPreview, {
            bucket: 'images',
            folder: 'poses',
            publicId: `template_${slug}_pose_${i}_${Date.now()}`
          });
          finalPreview = uploaded.url;
        }
        return { ...pose, previewImage: finalPreview };
      }));
    }

    let finalImageSlots = imageSlots;
    if (imageSlots && Array.isArray(imageSlots)) {
      finalImageSlots = await Promise.all(imageSlots.map(async (slot: any, i: number) => {
        let finalSample = slot.sampleImageUrl;
        if (finalSample && finalSample.startsWith('data:image/')) {
          const uploaded = await uploadToStorage(finalSample, {
            bucket: 'images',
            folder: 'slots',
            publicId: `template_${slug}_slot_${i}_${Date.now()}`
          });
          finalSample = uploaded.url;
        }
        return { ...slot, sampleImageUrl: finalSample };
      }));
    }

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
        coverImage: finalCoverImage || null,
        description: description || null,
        garmentType: garmentType || null,
        systemPrompt: systemPrompt || null,
        negativePrompt: negativePrompt || null,
        cameraSettings: cameraSettings || null,
        allowModelSelection: allowModelSelection ?? true,
        defaultModelId: defaultModelId || null,
        allowedModelIds: allowedModelIds || null,
        imageSlots: {
          create: (finalImageSlots || []).map((slot: any, i: number) => ({
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
          create: (finalPoses || []).map((pose: any, i: number) => ({
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
