import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Ensure table exists safely
async function ensureStudioConfigTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StudioConfig" (
        "id" TEXT PRIMARY KEY,
        "selectedEngine" TEXT NOT NULL DEFAULT 'gpt-image-2',
        "defaultResolution" TEXT NOT NULL DEFAULT '4k',
        "defaultAspectRatio" TEXT NOT NULL DEFAULT '3:4',
        "defaultModelPersonaId" TEXT,
        "globalSystemPrompt" TEXT,
        "globalNegativePrompt" TEXT,
        "apiRoute" TEXT NOT NULL DEFAULT 'generate',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Try to add the column in case the table existed before apiRoute was added
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "StudioConfig" ADD COLUMN "apiRoute" TEXT NOT NULL DEFAULT 'generate';`);
    } catch(err) {
      // Ignore, likely means the column already exists
    }
  } catch (e) {
    console.warn('[StudioConfig DB Check]', e);
  }
}

// GET /api/admin/studio-config
export async function GET() {
  try {
    await ensureStudioConfigTable();

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM "StudioConfig" WHERE "id" = 'global_studio_config' LIMIT 1;
    `);

    if (rows.length > 0) {
      return NextResponse.json({ config: rows[0] });
    }

    // Insert initial row
    await prisma.$executeRawUnsafe(`
      INSERT INTO "StudioConfig" ("id", "selectedEngine", "defaultResolution", "defaultAspectRatio", "apiRoute", "updatedAt")
      VALUES ('global_studio_config', 'Qubico/flux1-dev', '4k', '3:4', 'generate', NOW())
      ON CONFLICT ("id") DO UPDATE SET "selectedEngine" = 'Qubico/flux1-dev';
    `);

    return NextResponse.json({
      config: {
        id: 'global_studio_config',
        selectedEngine: 'Qubico/flux1-dev',
        defaultResolution: '4k',
        defaultAspectRatio: '3:4',
        apiRoute: 'generate',
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/studio-config error]:', error);
    return NextResponse.json(
      {
        config: {
          id: 'global_studio_config',
          selectedEngine: 'Qubico/flux1-dev',
          defaultResolution: '4k',
          defaultAspectRatio: '3:4',
          apiRoute: 'generate',
        },
      },
      { status: 200 }
    );
  }
}

// POST /api/admin/studio-config
export async function POST(req: NextRequest) {
  try {
    await ensureStudioConfigTable();

    const body = await req.json();
    const {
      selectedEngine = 'Qubico/flux1-dev',
      defaultResolution = '4k',
      defaultAspectRatio = '3:4',
      defaultModelPersonaId = null,
      globalSystemPrompt = null,
      globalNegativePrompt = null,
      apiRoute = 'generate',
    } = body;

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "StudioConfig" (
        "id", "selectedEngine", "defaultResolution", "defaultAspectRatio",
        "defaultModelPersonaId", "globalSystemPrompt", "globalNegativePrompt", "apiRoute", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "selectedEngine" = EXCLUDED."selectedEngine",
        "defaultResolution" = EXCLUDED."defaultResolution",
        "defaultAspectRatio" = EXCLUDED."defaultAspectRatio",
        "defaultModelPersonaId" = EXCLUDED."defaultModelPersonaId",
        "globalSystemPrompt" = EXCLUDED."globalSystemPrompt",
        "globalNegativePrompt" = EXCLUDED."globalNegativePrompt",
        "apiRoute" = EXCLUDED."apiRoute",
        "updatedAt" = NOW();
      `,
      'global_studio_config',
      selectedEngine,
      defaultResolution,
      defaultAspectRatio,
      defaultModelPersonaId,
      globalSystemPrompt,
      globalNegativePrompt,
      apiRoute
    );

    // If default model is set, update AIModel table if possible
    if (defaultModelPersonaId) {
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "AIModel" SET "isDefault" = CASE WHEN "id" = $1 THEN true ELSE false END;
        `, defaultModelPersonaId);
      } catch (mErr) {
        console.warn('[AIModel isDefault update note]:', mErr);
      }
    }

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM "StudioConfig" WHERE "id" = 'global_studio_config' LIMIT 1;
    `);

    return NextResponse.json({ config: rows[0] || body });
  } catch (error: any) {
    console.error('[POST /api/admin/studio-config error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to save configuration' }, { status: 500 });
  }
}
