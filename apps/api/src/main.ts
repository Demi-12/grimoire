/**
 * Starts the server: the NestJS API under /api and, when the web app has been built, its files and
 * index.html for everything else. Order of the middleware below is the order a request goes through.
 */
import "reflect-metadata";
import compression from "compression";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { authMiddleware } from "./auth/auth.middleware.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { securityMiddleware } from "./common/security.middleware.js";
import { createWebMiddleware } from "./web/web.middleware.js";

async function bootstrap() {
  // No global body parser: each route reads its body with its own size limit (common/request-body.ts),
  // and better-auth needs the raw stream.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.disable("x-powered-by");
  // Responses are small JSON documents read with `cache: "no-store"`; ETags would only cost a hash.
  app.set("etag", false);
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  // gzip for the bundles and JSON; it leaves `Cache-Control: no-transform` responses (the map's SSE) alone.
  app.use(compression());
  app.use(securityMiddleware);
  app.use(authMiddleware);
  for (const handler of createWebMiddleware()) app.use(handler);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, process.env.HOST?.trim() || "0.0.0.0");
}

await bootstrap();
