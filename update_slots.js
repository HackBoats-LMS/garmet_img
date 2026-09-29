const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kurtiTemplateId = 'cmubo7jw10000eqsgfxculeha';

  // 1. Body
  await prisma.imageSlot.update({
    where: { id: 'main_body' },
    data: {
      name: 'Body',
      description: 'Main body, kurti print, and fabric design',
      isRequired: true,
    }
  });

  // 2. Pant
  await prisma.imageSlot.update({
    where: { id: 'yoke_neckline' },
    data: {
      name: 'Pant',
      description: 'Bottom pant, palazzo, or lower design',
      isRequired: false,
    }
  });

  // 3. Dupatta
  await prisma.imageSlot.update({
    where: { id: 'bottom_pant' },
    data: {
      name: 'Dupatta',
      description: 'Dupatta fabric, border, and print style',
      isRequired: false,
    }
  });

  console.log('Successfully updated Kurti image slots to Body, Pant, and Dupatta.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
