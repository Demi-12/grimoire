"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * No `onTwoFactorRedirect`/`twoFactorPage`: AuthPanel reads `twoFactorRedirect` from the sign-in result
 * and switches to its code step itself, so there is a single source of truth for that step.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), passkeyClient()],
});
