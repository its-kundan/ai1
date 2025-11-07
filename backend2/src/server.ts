/**
 * Server entry point
 */

import { buildApp } from './app';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '8001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const app = await buildApp();
    
    await app.listen({ port: PORT, host: HOST });
    
    logger.info({ port: PORT, host: HOST }, 'Server started');
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();

