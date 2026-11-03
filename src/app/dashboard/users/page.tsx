import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersView } from "@/components/views/UsersView";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  return (
    <>
      <PageHeader title="Users" subtitle="Manage members, tipsters and moderators." />
      <UsersView />
    </>
  );
}
