import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FootballGames } from "@/components/dashboard/FootballGames";
import { Crest } from "@/components/ui/Crest";
import { PageHeader } from "@/components/ui/PageHeader";
import { CLUBS, leagueBySlug, MATCHES } from "@/lib/data";

export function generateStaticParams() {
  return CLUBS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dashboard/clubs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: CLUBS.find((c) => c.slug === slug)?.team.name ?? "Club" };
}

export default async function ClubPage({ params }: PageProps<"/dashboard/clubs/[slug]">) {
  const { slug } = await params;
  const club = CLUBS.find((c) => c.slug === slug);
  if (!club) notFound();

  const league = leagueBySlug(club.league)!;
  const matches = MATCHES.filter((m) => m.home.name === club.team.name || m.away.name === club.team.name);
  const [primary, secondary] = club.team.colors;

  return (
    <>
      <PageHeader title={club.team.name} crumb="Clubs" subtitle="Favourite club" />

      <section className="neu animate-rise mb-8 flex flex-wrap items-center gap-6 rounded-[28px] p-6">
        <div className="neu-inset grid size-28 place-items-center rounded-full">
          <Crest team={club.team} className="animate-float size-16" />
        </div>
        <div className="flex-1">
          <div className="font-display text-3xl font-bold">{club.team.name}</div>
          <Link href={`/dashboard/leagues/${league.slug}`} className="text-sm font-semibold text-primary hover:underline">
            {league.name} · {league.country}
          </Link>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            Club colours
            <span className="size-4 rounded-full ring-2 ring-surface" style={{ background: primary }} />
            <span className="size-4 rounded-full ring-2 ring-surface" style={{ background: secondary }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Info label="Founded" value={String(club.founded)} />
          <Info label="Stadium" value={club.stadium} />
        </div>
      </section>

      <FootballGames title="Club fixtures" league={league} matches={matches} />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-inset-sm rounded-2xl px-4 py-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
