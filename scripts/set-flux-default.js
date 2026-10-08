const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`UPDATE "KieModel" SET "isDefault" = false;`);
  await prisma.$executeRawUnsafe(`UPDATE "KieModel" SET "isDefault" = true WHERE "modelId" = 'flux-2/pro-image-to-image';`);
  console.log('Set flux-2/pro-image-to-image as default in DB.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
