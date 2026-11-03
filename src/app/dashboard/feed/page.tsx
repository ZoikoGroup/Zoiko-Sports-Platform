import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeedView } from "@/components/views/FeedView";

export const metadata: Metadata = { title: "My Feed" };

export default function Page() {
  return (
    <>
      <PageHeader title="My Feed" subtitle="Latest posts and tips from your tipsters." />
      <FeedView />
    </>
  );
}
