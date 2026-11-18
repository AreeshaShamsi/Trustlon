import 'reflect-metadata';
import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type ExpressHandler = (request: Request, response: Response) => void | Promise<void>;

let initialization: Promise<ExpressHandler> | undefined;

async function initialize(): Promise<ExpressHandler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app);
  await app.init();

  return app.getHttpAdapter().getInstance() as ExpressHandler;
}

function getHandler(): Promise<ExpressHandler> {
  initialization ??= initialize().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export default async function handler(request: Request, response: Response): Promise<void> {
  const expressHandler = await getHandler();
  await expressHandler(request, response);
}
