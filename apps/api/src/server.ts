import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = createServer(app);

let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, 'Shutting down');

  const forceShutdownTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceShutdownTimer.unref();

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'HTTP server failed to close cleanly');
    }

    prisma
      .$disconnect()
      .catch((disconnectError: unknown) => {
        logger.error({ err: disconnectError }, 'Prisma failed to disconnect cleanly');
      })
      .finally(() => {
        clearTimeout(forceShutdownTimer);
        process.exit(error ? 1 : 0);
      });
  });
}

server.on('error', (error) => {
  logger.fatal({ err: error }, 'HTTP server error');
  process.exit(1);
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'TaskForge API listening');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('uncaughtException');
});
