"use client";

import { useEffect } from "react";
import { installErrorReporting } from "@/lib/telemetry-client";

/** Sends uncaught browser errors to the admin's error log (see /admin/analytics). Renders nothing. */
export default function ErrorReporting() {
  useEffect(() => installErrorReporting(), []);
  return null;
}
