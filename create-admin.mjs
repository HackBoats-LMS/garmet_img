import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@myracouture.com';
  const password = 'adminpassword123';
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'admin',
    },
    create: {
      email,
      name: 'Admin',
      passwordHash,
      role: 'admin',
    },
  });

  console.log('Admin user created/updated successfully:');
  console.log('Email:', user.email);
  console.log('Password:', password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
