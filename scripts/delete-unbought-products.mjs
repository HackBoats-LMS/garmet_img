import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching products that have never been sold (ACTIVE or ARCHIVED)...');

  const toDelete = await prisma.stockItem.findMany({
    where: {
      status: { in: ['ACTIVE', 'ARCHIVED'] },
    },
    select: {
      id: true,
      stockCode: true,
      title: true,
      status: true,
      _count: { select: { poses: true } },
    },
  });

  if (toDelete.length === 0) {
    console.log('No unbought products found. Nothing to delete.');
    return;
  }

  console.log('Found ' + toDelete.length + ' product(s) to delete:');
  toDelete.forEach((item) => {
    console.log('  [' + item.status + '] ' + item.stockCode + ' - ' + item.title + ' (' + item._count.poses + ' pose images)');
  });

  console.log('Deleting...');

  const result = await prisma.stockItem.deleteMany({
    where: {
      status: { in: ['ACTIVE', 'ARCHIVED'] },
    },
  });

  console.log('Done! Deleted ' + result.count + ' product(s) and their associated pose images from the database.');
}

main()
  .catch((err) => {
    console.error('Error during deletion:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
