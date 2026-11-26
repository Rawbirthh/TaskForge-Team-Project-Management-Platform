import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Test database migrations use TEST_DATABASE_URL, never the development URL.
config({ path: '.env.test', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.TEST_DATABASE_URL ?? '',
  },
});
