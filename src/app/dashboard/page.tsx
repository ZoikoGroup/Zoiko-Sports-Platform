import type { Metadata } from "next";
import { FootballGames } from "@/components/dashboard/FootballGames";
import { HeroMatch } from "@/components/dashboard/HeroMatch";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { BalanceCard, Notifications, TopFollowing } from "@/components/dashboard/RightPanel";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="grid gap-7 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-7">
        <div className="animate-rise">
          <HeroMatch />
        </div>
        <div className="animate-rise [animation-delay:120ms]">
          <KpiCards />
        </div>
        <div className="animate-rise [animation-delay:220ms]">
          <FootballGames />
        </div>
      </div>

      <aside className="grid content-start gap-7 md:grid-cols-2 2xl:grid-cols-1">
        <div className="animate-rise [animation-delay:150ms]">
          <TopFollowing />
        </div>
        <div className="animate-rise [animation-delay:250ms]">
          <BalanceCard />
        </div>
        <div className="animate-rise [animation-delay:350ms] md:col-span-2 2xl:col-span-1">
          <Notifications />
        </div>
      </aside>
    </div>
  );
}
