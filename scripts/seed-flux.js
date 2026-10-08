const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "KieModel" ("id","displayName","modelId","isImageToImage","description","isActive","isDefault","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, 'Flux 2 Pro — Image-to-Image', 'flux-2/pro-image-to-image', true, 'High-end Flux Pro model for reference image processing.', true, false, 2, NOW(), NOW())
    ON CONFLICT ("modelId") DO NOTHING;
  `);
  console.log('Flux model added to db.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
