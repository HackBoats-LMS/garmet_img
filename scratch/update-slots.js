const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.garmentTemplate.findMany({
    include: { imageSlots: true }
  });
  
  for (const template of templates) {
    if (template.name.toLowerCase().includes('saree')) {
      for (const slot of template.imageSlots) {
        if (slot.name.toLowerCase().includes('blouse')) {
          await prisma.imageSlot.update({
            where: { id: slot.id },
            data: { isRequired: false }
          });
          console.log(`Updated blouse slot for template: ${template.name}`);
        }
      }
    }
  }
  console.log('Done updating database slots.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
