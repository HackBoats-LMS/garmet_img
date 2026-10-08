const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "AIModel" ("id","name","tagline","imageUrl","skinTone","features","promptAnchor","isActive","isDefault","sortOrder","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, 'Divya', 'Modern Everyday Muse', '/model_divya.jpg', 'Warm Wheatish', 'Large expressive brown eyes, long wavy brown hair, natural skin texture, serene confident expression', 'Consistent identity: Divya, a 35-year-old Indian female fashion model, warm wheatish skin tone with natural texture, large brown eyes, long wavy brown hair, serene confident expression, modern elegance', true, false, 3, NOW(), NOW());
  `);
  console.log('Added Divya model to db.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
