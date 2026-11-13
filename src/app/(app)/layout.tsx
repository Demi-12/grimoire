import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import Toolkit from "@/components/toolkit";

export const dynamic = "force-dynamic";

/**
 * Toolkit owns the whole signed-in UI and picks its view from the URL, so it lives in the
 * shared layout and stays mounted (with its loaded data) while people move between routes.
 * The pages below render nothing themselves.
 *
 * The session cookie is httpOnly, so only the server can see it: its presence (not its validity,
 * which get-session checks) tells Toolkit whether to paint the app skeleton or the sign-in one.
 */
export default async function AppLayout() {
  const sessionHint = getSessionCookie(await headers()) !== null;
  return <Toolkit sessionHint={sessionHint} />;
}
