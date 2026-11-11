const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.garmentTemplate.findFirst({
    where: { slug: 'saree' },
    include: { poses: true, imageSlots: true }
  });
  console.log('Template:', t?.name, 'slug:', t?.slug);
  console.log('Image slots:', t?.imageSlots);
  console.log('Poses:', t?.poses?.map(p => ({ id: p.id, name: p.name, snippet: p.promptSnippet })));
}
main().catch(console.error).finally(() => prisma['$disconnect']());

