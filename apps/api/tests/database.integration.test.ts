import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '.env.test', quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseName = testDatabaseUrl
  ? decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\//, ''))
  : '';

const client =
  testDatabaseUrl && testDatabaseName
    ? new PrismaClient({
        adapter: new PrismaMariaDb(testDatabaseUrl, { database: testDatabaseName }),
      })
    : null;

afterAll(async () => {
  await client?.$disconnect();
});

describe.skipIf(client === null)('MySQL integration', () => {
  it('connects to the isolated test database and reads the migrated table', async () => {
    if (client === null) {
      throw new Error('Test database client is not configured');
    }

    const rows = await client.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
    expect(rows[0]?.result).toBe(1);

    const setting = await client.systemSetting.findFirst({ select: { key: true } });
    expect(setting === null || typeof setting.key === 'string').toBe(true);
  });
});
