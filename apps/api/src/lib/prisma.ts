import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

function getDatabaseName(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (name.length === 0) {
    throw new Error('DATABASE_URL must include a database name');
  }
  return name;
}

function createPrismaClient() {
  const adapter = new PrismaMariaDb(env.DATABASE_URL, {
    database: getDatabaseName(env.DATABASE_URL),
  });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as typeof globalThis & {
  taskforgePrisma?: PrismaClientInstance;
};

export const prisma: PrismaClientInstance = globalForPrisma.taskforgePrisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.taskforgePrisma = prisma;
}
