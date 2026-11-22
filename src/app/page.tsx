import { KeyBenchApp } from "@/components/KeyBenchApp";
import { getWorkspaceData } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getWorkspaceData({ includeRawKeys: false });
  return <KeyBenchApp initialData={initialData} />;
}
