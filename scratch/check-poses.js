const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const templates = await p.garmentTemplate.findMany({
    include: { poses: { orderBy: { sortOrder: 'asc' } } },
  });
  console.log(`Found ${templates.length} templates:`);
  for (const t of templates) {
    console.log(`\n=== Template: ${t.name} (${t.slug}, id: ${t.id}) ===`);
    console.log(`Poses count: ${t.poses.length}`);
    for (const pose of t.poses) {
      console.log(` - [${pose.id}] ${pose.name} (${pose.category}) previewImage: ${pose.previewImage || 'NONE'}`);
      console.log(`   Snippet: ${pose.promptSnippet}`);
    }
  }
}

run().catch(console.error).finally(() => p.$disconnect());
