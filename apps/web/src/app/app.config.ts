import { ErrorHandler, provideBrowserGlobalErrorListeners, type ApplicationConfig } from "@angular/core";
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from "@angular/router";
import { routes } from "./app.routes";
import { CrashService } from "./core/crash.service";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useExisting: CrashService },
    // Route params arrive as component inputs; a new page starts at the top, and `#fragment` links scroll to their target.
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: "enabled", anchorScrolling: "enabled" })),
  ],
};
