/**
 * Turns everything a handler throws into the API's `{ error, code? }` JSON. Expected failures are ApiError
 * (or Nest's own HttpException, e.g. an unknown route). Anything else is a bug: it is logged, stored in
 * the `app_error` table for the admin dashboard, and answered with a bare 500.
 */
import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { recordError, userIdFromHeaders } from "../data/analytics-server.js";
import { ApiError } from "./api-error.js";
import type { AppRequest } from "./current-user.js";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<AppRequest>();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      // A stream that already started (the map's SSE) can only be closed.
      if (response.headersSent) { response.end(); return; }
      if (exception instanceof ApiError) {
        for (const [name, value] of Object.entries(exception.headers)) response.setHeader(name, value);
        response.status(exception.getStatus()).json(exception.getResponse());
        return;
      }
      const status = exception.getStatus();
      response.status(status).json({ error: status === 404 ? "Not found." : exception.message });
      return;
    }

    const cause = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${request.method} ${request.originalUrl}: ${cause.message}`, cause.stack);
    void this.report(cause, request);
    if (response.headersSent) { response.end(); return; }
    response.status(500).json({ error: "Internal server error." });
  }

  /** Reporting must never throw from inside error handling. */
  private async report(cause: Error, request: AppRequest): Promise<void> {
    try {
      const headers = fromNodeHeaders(request.headers);
      const routePath = (request.route as { path?: unknown } | undefined)?.path;
      await recordError("server", {
        name: cause.name,
        message: cause.message,
        stack: cause.stack ?? null,
        // The route pattern (/api/campaigns/:id/map) groups errors better than each concrete URL.
        route: typeof routePath === "string" ? routePath : request.path,
        method: request.method,
        digest: null,
      }, { userId: request.grimoireUser?.id ?? await userIdFromHeaders(headers), userAgent: headers.get("user-agent") });
    } catch {
      // Nothing else to do: the error is already in the server log.
    }
  }
}
