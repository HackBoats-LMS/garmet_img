import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.garmentTemplate.findMany({
    include: { customOptions: true }
  });

  for (const template of templates) {
    const hasJewellery = template.customOptions.some(opt => opt.label === 'Jewellery Styling');
    if (!hasJewellery) {
      // Find the highest sortOrder to append the new option at the end
      const maxSortOrder = template.customOptions.reduce((max, opt) => Math.max(max, opt.sortOrder), -1);
      
      await prisma.templateOption.create({
        data: {
          templateId: template.id,
          label: 'Jewellery Styling',
          optionType: 'radio',
          choices: JSON.stringify(['Minimal / No Jewellery', 'Light Elegant Jewellery', 'Heavy Bridal / Antique Jewellery']),
          sortOrder: maxSortOrder + 1
        }
      });
      console.log(`Added Jewellery Styling to template: ${template.name}`);
    } else {
      console.log(`Template ${template.name} already has Jewellery Styling`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
