import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Get the verified server-side session in a Server Component or Route Handler. */
export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}
