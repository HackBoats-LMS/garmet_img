const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`UPDATE "AIModel" SET "name" = 'Priyanka', "promptAnchor" = 'Consistent identity: Priyanka, a 35-year-old Indian female fashion model, warm wheatish skin tone with natural texture, large brown eyes, long wavy brown hair, serene confident expression, modern elegance' WHERE "name" = 'Divya';`);
  console.log('Renamed Divya to Priyanka in DB.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
