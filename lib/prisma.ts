import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const logLevel = process.env.NODE_ENV === 'development'
  ? ['query', 'info', 'warn', 'error'] as Array<'query' | 'info' | 'warn' | 'error'>  // Enable query logging in dev
  : ['warn', 'error'] as Array<'warn' | 'error'>;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevel,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
