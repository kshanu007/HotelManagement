import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import mongoose from 'mongoose';
await connectDatabase();
const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
