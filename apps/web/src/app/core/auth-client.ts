import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * better-auth's browser client (framework-agnostic build), talking to /api/auth on this same origin.
 * Components read the session through SessionService (a signal), not from here.
 *
 * No `onTwoFactorRedirect`/`twoFactorPage`: AuthPanel reads `twoFactorRedirect` from the sign-in result
 * and switches to its code step itself, so there is a single source of truth for that step.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), passkeyClient()],
});
