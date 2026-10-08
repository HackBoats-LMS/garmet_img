const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "KieModel" ("id","displayName","modelId","isImageToImage","description","isActive","isDefault","sortOrder","createdAt","updatedAt")
     VALUES (gen_random_uuid()::text, 'Nano Banana 2.1 (2k)', 'nano-banana-2-1 2k', true, 'High-speed image generation model.', true, false, 3, NOW(), NOW())
     ON CONFLICT ("modelId") DO NOTHING;`
  );
  console.log('Added Nano Banana 2.1 model to database.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
