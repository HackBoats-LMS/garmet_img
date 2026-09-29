const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const models = [
    {
      id: 'model_priyanka',
      name: 'Priyanka',
      tagline: 'Home CEO (Premium)',
      imageUrl: '/model_priyanka.jpg',
      skinTone: 'Medium to Deep #7D4F33',
      features: 'Composed, gracious private half-smile',
      promptAnchor: 'Consistent identity: Priyanka, a ~28-year-old premium Indian female model, warm medium-deep skin tone, composed gracious expression with a private half-smile, warm glance off-frame',
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'model_anjali',
      name: 'Anjali',
      tagline: 'Home CEO (Everyday)',
      imageUrl: '/model_anjali.jpg',
      skinTone: 'Wheatish #C99A6B',
      features: 'Composed, gracious private half-smile',
      promptAnchor: 'Consistent identity: Anjali, a ~26-year-old everyday Indian female model, warm wheatish skin tone, composed gracious expression with a private half-smile, warm glance off-frame',
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'model_sana',
      name: 'Sana',
      tagline: 'Professional Connoisseur',
      imageUrl: '/model_sana.jpg',
      skinTone: 'Medium #A97155',
      features: 'Direct, capable, confident half-smile',
      promptAnchor: 'Consistent identity: Sana, a ~28-year-old professional Indian female model, warm medium skin tone, direct capable expression with a confident half-smile, gaze toward where she is going',
      isActive: true,
      sortOrder: 3,
    },
    {
      id: 'model_navya',
      name: 'Navya',
      tagline: 'Professional Connoisseur (Light)',
      imageUrl: '/model_navya.jpg',
      skinTone: 'Deep #7D4F33',
      features: 'Direct, capable, confident half-smile',
      promptAnchor: 'Consistent identity: Navya, a ~28-year-old professional Indian female model, warm deep skin tone, direct capable expression with a confident half-smile, gaze toward where she is going',
      isActive: true,
      sortOrder: 4,
    }
  ];

  for (const model of models) {
    // We cannot upsert by ID if it's not unique or we can just try to findFirst by name, but ID is @id in schema, so we can't manually set id on create unless it's a String @id without @default(cuid()) wait, schema says @id @default(cuid()), so we can provide it.
    // Actually upserting by id works.
    await prisma.aIModel.upsert({
      where: { id: model.id },
      update: model,
      create: model,
    });
  }
  
  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
