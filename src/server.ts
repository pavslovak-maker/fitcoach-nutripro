// ============================================================
// Server — Fastify entrypoint
// ============================================================

// MUSÍ být první — načte .env před vším ostatním
import 'dotenv/config';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './api/routes';

async function bootstrap() {
  // Kontrola povinných env proměnných
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Chybí environment proměnné:', missing.join(', '));
    console.error('   Zkontroluj soubor .env');
    process.exit(1);
  }

  // AI klíč není povinný pro start, ale bez něj AI nefunguje
  if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')) {
    console.warn('⚠️  ANTHROPIC_API_KEY není nastavený nebo má špatný formát.');
    console.warn('   AI generování plánů nebude fungovat.');
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // Prázdné tělo u POST je legitimní (např. /ai/generate) —
  // bez tohohle Fastify hodí FST_ERR_CTP_EMPTY_JSON_BODY
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body: string, done) => {
      if (!body || body.trim() === '') return done(null, {});
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error, url: request.url });

    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'validation_error', details: error.message });
    }
    if ((error as any).code === 'P2002') {
      return reply.status(409).send({ error: 'duplicate_entry' });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'internal_error' : error.message,
    });
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  console.log(`🎯 Attempting to listen on port ${port}...`);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`✅ Server successfully listening on port ${port}`);
}

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

console.log('🚀 Bootstrap starting...');

bootstrap().catch((err) => {
  console.error('❌ Fatal error during bootstrap:', err);
  console.error(err.stack);
  process.exit(1);
});
