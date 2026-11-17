import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { reportClientError } from "./app/core/telemetry-client";

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  console.error(error);
  reportClientError(error);
});
