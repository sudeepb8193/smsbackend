import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { API_PREFIX } from './config/api.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix from config file
  app.setGlobalPrefix(API_PREFIX);

  // Enable CORS for frontend Vite dev server
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global exception filter for uniform error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor for uniform success responses
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Serve static uploaded assets (/uploads/...)
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `Backend server running on http://localhost:${port}/${API_PREFIX} 🚀`,
  );
}
void bootstrap();
