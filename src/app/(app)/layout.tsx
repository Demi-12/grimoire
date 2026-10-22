import Toolkit from "@/components/toolkit";

export const dynamic = "force-dynamic";

/**
 * Toolkit owns the whole signed-in UI and picks its view from the URL, so it lives in the
 * shared layout and stays mounted (with its loaded data) while people move between routes.
 * The pages below render nothing themselves.
 */
export default function AppLayout() {
  return <Toolkit />;
}
