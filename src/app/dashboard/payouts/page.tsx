import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { PayoutsView } from "@/components/views/PayoutsView";

export const metadata: Metadata = { title: "Payouts" };

export default function Page() {
  return (
    <>
      <PageHeader title="Payouts" subtitle="Review and approve withdrawal requests." />
      <PayoutsView />
    </>
  );
}
