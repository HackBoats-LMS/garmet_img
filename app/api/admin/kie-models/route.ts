import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_KIE_MODELS = [
  {
    displayName: 'GPT Image 2.5 Sunburst — Image-to-Image',
    modelId: 'gpt-image-2-5-sunburst-image-to-image',
    isImageToImage: true,
    description: 'Best for garment photoshoots with fabric reference images. Accepts input_urls. Highest realism.',
    isActive: true,
    isDefault: false,
    sortOrder: 0,
  },
  {
    displayName: 'GPT Image 2.5 Sunburst — Text-to-Image',
    modelId: 'gpt-image-2-5-sunburst-text-to-image',
    isImageToImage: false,
    description: 'Text-only generation — no input images required. Good for background / concept shots.',
    isActive: true,
    isDefault: false,
    sortOrder: 1,
  },
  {
    displayName: 'Flux 2 Pro — Image-to-Image',
    modelId: 'flux-2/pro-image-to-image',
    isImageToImage: true,
    description: 'High-end Flux Pro model for reference image processing and extreme photorealism.',
    isActive: true,
    isDefault: true,
    sortOrder: 2,
  },
  {
    displayName: 'Nano Banana 2.1 (2k)',
    modelId: 'nano-banana-2-1 2k',
    isImageToImage: true,
    description: 'High-speed image generation model.',
    isActive: true,
    isDefault: false,
    sortOrder: 3,
  },
];

// Ensure KieModel table exists via raw SQL (safety net before prisma client is ready)
async function ensureKieModelTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "KieModel" (
        "id"             TEXT PRIMARY KEY,
        "displayName"    TEXT NOT NULL,
        "modelId"        TEXT NOT NULL UNIQUE,
        "isImageToImage" BOOLEAN NOT NULL DEFAULT true,
        "description"    TEXT,
        "isActive"       BOOLEAN NOT NULL DEFAULT true,
        "isDefault"      BOOLEAN NOT NULL DEFAULT false,
        "sortOrder"      INTEGER NOT NULL DEFAULT 0,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('[KieModel Table Ensure]:', e);
  }
}

// GET /api/admin/kie-models
export async function GET() {
  try {
    await ensureKieModelTable();

    let models: any[] = [];
    try {
      models = await prisma.$queryRawUnsafe(
        `SELECT * FROM "KieModel" ORDER BY "sortOrder" ASC, "createdAt" ASC;`
      );
    } catch (e) {
      console.warn('[KieModel GET raw fallback]:', e);
      try {
        models = await (prisma as any).kieModel.findMany({ orderBy: { sortOrder: 'asc' } });
      } catch (e2) {
        console.error('[KieModel GET prisma fallback failed]:', e2);
      }
    }

    // Auto-seed if empty
    if (!models || models.length === 0) {
      console.log('[KieModel] Empty — seeding defaults...');
      for (const m of DEFAULT_KIE_MODELS) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "KieModel" ("id","displayName","modelId","isImageToImage","description","isActive","isDefault","sortOrder","createdAt","updatedAt")
             VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
             ON CONFLICT ("modelId") DO NOTHING;`,
            m.displayName, m.modelId, m.isImageToImage, m.description, m.isActive, m.isDefault, m.sortOrder
          );
        } catch (seedErr) {
          console.warn('[KieModel Seed Error]:', seedErr);
        }
      }
      try {
        models = await prisma.$queryRawUnsafe(
          `SELECT * FROM "KieModel" ORDER BY "sortOrder" ASC, "createdAt" ASC;`
        );
      } catch {
        models = DEFAULT_KIE_MODELS.map((m, i) => ({ id: `default_${i}`, ...m }));
      }
    }

    if (!models || models.length === 0) {
      models = DEFAULT_KIE_MODELS.map((m, i) => ({ id: `default_${i}`, ...m }));
    }

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('[GET /api/admin/kie-models]:', error);
    return NextResponse.json({ models: DEFAULT_KIE_MODELS.map((m, i) => ({ id: `default_${i}`, ...m })) });
  }
}

// POST /api/admin/kie-models — Create a new Kie.ai model entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { displayName, modelId, isImageToImage = true, description, isActive = true, sortOrder = 10 } = body;

    if (!displayName || !modelId) {
      return NextResponse.json({ error: 'displayName and modelId are required' }, { status: 400 });
    }

    await ensureKieModelTable();

    const newId = `kie_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KieModel" ("id","displayName","modelId","isImageToImage","description","isActive","isDefault","sortOrder","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,NOW(),NOW())
       ON CONFLICT ("modelId") DO UPDATE SET
         "displayName" = EXCLUDED."displayName",
         "isImageToImage" = EXCLUDED."isImageToImage",
         "description" = EXCLUDED."description",
         "isActive" = EXCLUDED."isActive",
         "sortOrder" = EXCLUDED."sortOrder",
         "updatedAt" = NOW();`,
      newId, displayName, modelId, isImageToImage, description || null, isActive, sortOrder
    );

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "KieModel" WHERE "modelId" = $1 LIMIT 1;`, modelId
    );

    return NextResponse.json({ model: rows[0] || { id: newId, displayName, modelId, isImageToImage } }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/admin/kie-models]:', error);
    return NextResponse.json({ error: error.message || 'Failed to create model' }, { status: 500 });
  }
}
