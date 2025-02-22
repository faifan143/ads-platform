import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { config } from 'dotenv';

async function bootstrap() {
  // Initialize logger
  const logger = new Logger('Bootstrap');

  // Load environment variables
  config();

  // Create the app
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Middleware setup
  app.use(cookieParser());

  // CORS configuration
  const corsConfig = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  };
  app.enableCors(corsConfig);

  // Get port
  const port = process.env.PORT || 8000;

  // Start server
  await app.listen(port, '0.0.0.0', () => {
    logger.log('==========================================================');
    logger.log(`🚀 Server is running | http://localhost:${port}`);
    logger.log(`📝 Environment     | ${process.env.NODE_ENV || 'development'}`);
    logger.log(`🔒 Cookie Parser   | Enabled`);
    logger.log(`🌐 CORS           | ${corsConfig.origin}`);
    logger.log(
      `🔑 Credentials    | ${corsConfig.credentials ? 'Enabled' : 'Disabled'}`,
    );
    logger.log('==========================================================');

    // Log warning if using default port
    if (!process.env.PORT) {
      logger.warn('No PORT environment variable set, using default port 8000');
    }

    // Log warning if using wildcard CORS in production
    if (process.env.NODE_ENV === 'production' && corsConfig.origin === '*') {
      logger.warn('Using wildcard CORS origin (*) in production environment');
    }
  });

  // Handle shutdown gracefully
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.warn(`Received ${signal}, gracefully shutting down...`);
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
