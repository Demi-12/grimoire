import Toolkit from "@/components/toolkit";
import { googleConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Toolkit googleEnabled={googleConfigured} />;
}
