const fs = require('fs');
const envData = fs.readFileSync('.env.local', 'utf8');
for(const line of envData.split('\n')) {
  if(line.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = line.substring(13).trim().replace(/['"]+/g, '');
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() { const t = await prisma.garmentTemplate.findMany(); console.log(t.map(x => ({id: x.id, slug: x.slug, name: x.name, coverImage: x.coverImage}))); } main().finally(() => prisma.$disconnect());
