import type { Instrumentation } from "next";

/**
 * Every uncaught server error (route handlers, server rendering, the proxy) goes to the app_error table so
 * admins see it on the analytics dashboard. Next still logs it to the console as before.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The database pool only exists in the Node.js runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordError, userIdFromHeaders } = await import("@/lib/analytics-server");
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    const cause = error instanceof Error ? error : new Error(String(error));
    await recordError("server", {
      name: cause.name,
      message: cause.message,
      stack: cause.stack ?? null,
      // routePath is the pattern (/api/campaigns/[id]/map); the request path is the fallback.
      route: context.routePath || request.path,
      method: request.method,
      digest: typeof (error as { digest?: unknown }).digest === "string" ? (error as { digest: string }).digest : null,
    }, { userId: await userIdFromHeaders(headers), userAgent: headers.get("user-agent") });
  } catch {
    // Reporting must never throw from inside Next's error handling.
  }
};
