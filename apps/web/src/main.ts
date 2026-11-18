import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { installErrorReporting, reportClientError } from "./app/core/telemetry-client";

// Uncaught browser errors go to the admin's error log (see /admin/analytics) for as long as the page lives.
installErrorReporting();

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  console.error(error);
  reportClientError(error);
});
