import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { TipstersView } from "@/components/views/TipstersView";

export const metadata: Metadata = { title: "Tipsters" };

export default function Page() {
  return (
    <>
      <PageHeader title="Tipsters" subtitle="Top performers ranked by win rate and profit." />
      <TipstersView />
    </>
  );
}
