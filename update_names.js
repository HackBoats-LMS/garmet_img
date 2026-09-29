const fs = require('fs');
const envData = fs.readFileSync('.env.local', 'utf8');
for(const line of envData.split('\n')) {
  if(line.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = line.substring(13).trim().replace(/['"]+/g, '');
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.garmentTemplate.updateMany({
    where: { slug: 'saree' },
    data: { name: 'Saree', coverImage: '/poses/saree_pose_1.jpg' }
  });
  
  await prisma.garmentTemplate.updateMany({
    where: { slug: 'kurti' },
    data: { name: 'Kurti', coverImage: '/poses/kurti_pose_1.jpg' }
  });
  console.log('Successfully updated template names and cover images!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
