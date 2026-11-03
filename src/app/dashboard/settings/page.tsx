import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsView } from "@/components/views/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Profile, notifications, appearance and security." />
      <SettingsView />
    </>
  );
}
