const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.product.createMany({
    data: [
      {
        stockCode: 'BATCH-1111',
        designNumber: 'DES-SAREE-01',
        friendlyCode: 'saree-red-101',
        whatsappCatalogueTitle: 'Crimson Red Bridal Saree',
        title: 'Crimson Red Bridal Saree',
        price: 3500.00,
        mrp: 4000.00,
        quantity: 10,
        description: 'Beautiful crimson red bridal saree perfect for weddings.',
        clothType: 'Silk',
        status: 'ACTIVE'
      },
      {
        stockCode: 'BATCH-2222',
        designNumber: 'DES-KURTI-02',
        friendlyCode: 'kurti-yellow-102',
        whatsappCatalogueTitle: 'Yellow Summer Cotton Kurti',
        title: 'Yellow Summer Cotton Kurti',
        price: 1200.00,
        mrp: 1500.00,
        quantity: 15,
        description: 'Lightweight and breathable yellow cotton kurti for the summer.',
        clothType: 'Cotton',
        status: 'ACTIVE'
      }
    ],
    skipDuplicates: true
  });
  console.log('Dummy products inserted into the cloud database!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
