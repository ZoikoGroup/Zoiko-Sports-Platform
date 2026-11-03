import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { HotTipsView } from "@/components/views/HotTipsView";

export const metadata: Metadata = { title: "Hot Tips" };

export default function Page() {
  return (
    <>
      <PageHeader title="Hot Tips" subtitle="Most-backed tips right now. Feature or approve them." />
      <HotTipsView />
    </>
  );
}
