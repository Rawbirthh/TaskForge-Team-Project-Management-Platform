import { prisma } from '../src/lib/prisma.js';

const SCHEMA_SETTING_KEY = 'schema.version';
const SCHEMA_SETTING_VALUE = '1';

async function main(): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SCHEMA_SETTING_KEY },
    create: { key: SCHEMA_SETTING_KEY, value: SCHEMA_SETTING_VALUE },
    update: { value: SCHEMA_SETTING_VALUE },
  });

  console.info(`Seed complete: ${SCHEMA_SETTING_KEY}=${SCHEMA_SETTING_VALUE}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
