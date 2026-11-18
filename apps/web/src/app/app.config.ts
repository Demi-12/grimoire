import { ErrorHandler, type ApplicationConfig } from "@angular/core";
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from "@angular/router";
import { routes } from "./app.routes";
import { CrashService } from "./core/crash.service";

export const appConfig: ApplicationConfig = {
  providers: [
    // Errors Angular catches (templates, effects, handlers) go to CrashService. Uncaught ones outside Angular
    // (window `error`, unhandled rejections) are reported by installErrorReporting() in main.ts, which leaves out
    // browser extensions and aborted requests; so no provideBrowserGlobalErrorListeners() here.
    { provide: ErrorHandler, useExisting: CrashService },
    // Route params arrive as component inputs; a new page starts at the top, and `#fragment` links scroll to their target.
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: "enabled", anchorScrolling: "enabled" })),
  ],
};
