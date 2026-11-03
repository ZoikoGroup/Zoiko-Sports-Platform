import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FootballGames } from "@/components/dashboard/FootballGames";
import { PageHeader } from "@/components/ui/PageHeader";
import { leagueBySlug, LEAGUES, MATCHES } from "@/lib/data";

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dashboard/leagues/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: leagueBySlug(slug)?.name ?? "League" };
}

export default async function LeaguePage({ params }: PageProps<"/dashboard/leagues/[slug]">) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) notFound();

  const matches = MATCHES.filter((m) => m.league === league.slug);
  const stats = [
    { label: "Fixtures", value: matches.length },
    { label: "Live now", value: matches.filter((m) => m.status === "live").length },
    { label: "Tipsters", value: new Set(matches.flatMap((m) => m.tipsters)).size },
  ];

  return (
    <>
      <PageHeader title={league.name} crumb="Leagues" subtitle={`${league.country} · Favourite league`} />

      <section
        className="animate-rise relative mb-8 overflow-hidden rounded-[28px] p-6 text-white shadow-[10px_10px_24px_var(--sh-dark),-8px_-8px_20px_var(--sh-light)]"
        style={{ background: `linear-gradient(130deg, ${league.color}, #25163a 110%)` }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full border-[30px] border-white/10" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-6">
          <span className="grid size-20 place-items-center rounded-3xl bg-white/15 font-display text-2xl font-black backdrop-blur">{league.code}</span>
          <div className="flex-1">
            <div className="font-display text-3xl font-bold">{league.name}</div>
            <div className="text-white/70">{league.country}</div>
          </div>
          <div className="flex gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center backdrop-blur transition hover:-translate-y-1 hover:bg-white/20">
                <div className="font-display text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FootballGames title="Fixtures" league={league} matches={matches} />
    </>
  );
}
