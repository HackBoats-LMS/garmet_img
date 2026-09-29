import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULT_SEED_MODELS = [
  {
    name: 'Ananya',
    tagline: 'South Indian Royal Heritage Elegance',
    imageUrl: '/model_ananya.jpg',
    skinTone: 'Warm Golden Wheatish / Amber',
    features: 'Symmetrical almond eyes, straight sleek dark hair, ornate ruby kundan choker necklace, poised royal gaze',
    promptAnchor: 'Consistent identity: Ananya, a 24-year-old South Indian royal female model, warm golden-wheatish skin tone with radiant natural skin texture, symmetrical almond hazel-brown eyes, straight sleek dark hair styled in a neat traditional low bun with fresh white jasmine gajra flowers, elegant jawline, wearing an ornate antique ruby and emerald temple jewellery choker with jhumkas, serene confident expression',
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Meera',
    tagline: 'Contemporary Silk Saree Muse',
    imageUrl: '/model_meera.png',
    skinTone: 'Fair Radiant Ivory',
    features: 'High cheekbones, modern minimalist gold choker, gentle editorial smile, loose wavy hair strands',
    promptAnchor: 'Consistent identity: Meera, a 23-year-old contemporary Indian fashion model, fair radiant porcelain skin with dewy editorial finish, delicate facial structure, gentle warm brown eyes, high defined cheekbones, modern minimalist polki diamond necklace, soft natural makeup, modern luxury catalogue aesthetic',
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Priya',
    tagline: 'Bridal Grandeur & Haute Couture',
    imageUrl: '/model_priya.png',
    skinTone: 'Deep Dusky Golden Bronze',
    features: 'Deep warm bronze glow, ornate bridal matha patti, traditional kohl-lined expressive eyes',
    promptAnchor: 'Consistent identity: Priya, a 25-year-old grand Indian bridal model, deep warm golden-bronze dusky skin tone, strikingly expressive kohl-rimmed dark eyes, full lips with rosewood lipstick, elaborate 22k gold bridal jewellery set with intricate floral mathapatti on forehead, regal bride aura',
    isActive: true,
    sortOrder: 2,
  },
];

// Ensure AIModel table exists
async function ensureAIModelTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AIModel" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "tagline" TEXT,
        "imageUrl" TEXT,
        "skinTone" TEXT,
        "features" TEXT,
        "promptAnchor" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('[AIModel Table Ensure Warning]:', e);
  }
}

// GET /api/admin/models — List all AI models
export async function GET() {
  try {
    await ensureAIModelTable();

    let models: any[] = [];
    try {
      models = await prisma.$queryRawUnsafe(`
        SELECT * FROM "AIModel" ORDER BY "sortOrder" ASC, "createdAt" ASC;
      `);
    } catch (queryErr) {
      console.warn('[Admin Models GET Fallback to Prisma]:', queryErr);
      try {
        models = await (prisma.aIModel || (prisma as any).aiModel).findMany({
          orderBy: { sortOrder: 'asc' },
        });
      } catch (pErr) {
        console.error('[Prisma findMany failed]:', pErr);
      }
    }

    // Auto-seed if empty
    if (!models || models.length === 0) {
      console.log('[Admin Models] Table empty. Auto-seeding default AI models...');
      for (const m of DEFAULT_SEED_MODELS) {
        try {
          await prisma.$executeRawUnsafe(
            `
            INSERT INTO "AIModel" ("id", "name", "tagline", "imageUrl", "skinTone", "features", "promptAnchor", "isActive", "sortOrder", "createdAt", "updatedAt")
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW());
            `,
            m.name,
            m.tagline,
            m.imageUrl,
            m.skinTone,
            m.features,
            m.promptAnchor,
            m.isActive,
            m.sortOrder
          );
        } catch (seedErr) {
          console.warn('[Seed Model Item Error]:', seedErr);
        }
      }

      // Re-fetch after seeding
      try {
        models = await prisma.$queryRawUnsafe(`
          SELECT * FROM "AIModel" ORDER BY "sortOrder" ASC, "createdAt" ASC;
        `);
      } catch (e) {
        models = DEFAULT_SEED_MODELS.map((m, idx) => ({ id: `default_${idx}`, ...m }));
      }
    }

    // If still empty due to any DB connection glitch, return defaults so UI always works
    if (!models || models.length === 0) {
      models = DEFAULT_SEED_MODELS.map((m, idx) => ({ id: `default_${idx}`, ...m }));
    }

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('[GET /api/admin/models error]:', error);
    return NextResponse.json({
      models: DEFAULT_SEED_MODELS.map((m, idx) => ({ id: `default_${idx}`, ...m })),
    });
  }
}

// POST /api/admin/models — Create a new AI model
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, tagline, imageUrl, skinTone, features, promptAnchor, isActive } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const anchor = promptAnchor || `${name}, Indian female fashion model with natural skin tone`;

    try {
      const model = await (prisma.aIModel || (prisma as any).aiModel).create({
        data: {
          name,
          tagline: tagline || null,
          imageUrl: imageUrl || null,
          skinTone: skinTone || null,
          features: features || null,
          promptAnchor: anchor,
          isActive: isActive ?? true,
          sortOrder: 10,
        },
      });

      return NextResponse.json({ model }, { status: 201 });
    } catch (prismaErr) {
      console.warn('[POST Model fallback to raw SQL]:', prismaErr);
      const newId = `model_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "AIModel" ("id", "name", "tagline", "imageUrl", "skinTone", "features", "promptAnchor", "isActive", "sortOrder", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10, NOW(), NOW());
        `,
        newId,
        name,
        tagline || null,
        imageUrl || null,
        skinTone || null,
        features || null,
        anchor,
        isActive ?? true
      );

      return NextResponse.json({ model: { id: newId, name, imageUrl, isActive: true } }, { status: 201 });
    }
  } catch (error: any) {
    console.error('[Admin Models POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
