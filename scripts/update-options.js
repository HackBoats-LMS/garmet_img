const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const saree = await prisma.garmentTemplate.findUnique({ where: { slug: 'saree' } });
  if (saree) {
    await prisma.templateOption.deleteMany({ where: { templateId: saree.id } });
    await prisma.templateOption.create({
      data: {
        templateId: saree.id,
        label: 'Blouse Styling & Cut',
        optionType: 'radio',
        choices: [
          'Tailored from Uploaded Blouse Swatch',
          'Classic Elbow Sleeve',
          'Sleeveless Contemporary',
          'Heavy Zardozi / Embroidered',
        ],
        sortOrder: 0,
      },
    });
    console.log('✓ Successfully updated Saree template options in Database!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
