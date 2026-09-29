import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const options = await prisma.templateOption.findMany();

  for (const opt of options) {
    if (typeof opt.choices === 'string') {
      try {
        const parsedChoices = JSON.parse(opt.choices);
        await prisma.templateOption.update({
          where: { id: opt.id },
          data: { choices: parsedChoices }
        });
        console.log(`Fixed choices for option ${opt.id}`);
      } catch (e) {
        console.error(`Failed to parse choices for option ${opt.id}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
