import { ErrorHandler, provideAppInitializer, type ApplicationConfig } from "@angular/core";
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from "@angular/router";
import { routes } from "./app.routes";
import { scrollToAnchors } from "./core/anchor-scrolling";
import { CrashService } from "./core/crash.service";

export const appConfig: ApplicationConfig = {
  providers: [
    // Errors Angular catches (templates, effects, handlers) go to CrashService. Uncaught ones outside Angular
    // (window `error`, unhandled rejections) are reported by installErrorReporting() in main.ts, which leaves out
    // browser extensions and aborted requests; so no provideBrowserGlobalErrorListeners() here.
    { provide: ErrorHandler, useExisting: CrashService },
    // Route params arrive as component inputs and a new page starts at the top. `#fragment` links are handled by
    // scrollToAnchors(), which scrolls without focusing the target as Angular's anchorScrolling would.
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: "enabled" })),
    provideAppInitializer(scrollToAnchors),
  ],
};
