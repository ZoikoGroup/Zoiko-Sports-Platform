"use client";

import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Controls";
import { Crest } from "@/components/ui/Crest";
import { FEED, matchById } from "@/lib/data";

type Filter = "all" | "following" | "settled";

export function FeedView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const posts = FEED.filter((p) =>
    filter === "settled" ? matchById(p.match).status === "finished" : filter === "following" ? p.id !== "f4" : true,
  );

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { id: "all", label: "All posts" },
          { id: "following", label: "Following" },
          { id: "settled", label: "Settled" },
        ]}
      />

      {posts.map((p, i) => {
        const m = matchById(p.match);
        const isLiked = liked.has(p.id);
        return (
          <article key={p.id} style={{ animationDelay: `${i * 80}ms` }} className="neu-card animate-rise rounded-3xl p-5">
            <header className="flex items-center gap-3">
              <Avatar name={p.name} online={i % 2 === 0} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted">{p.time}</div>
              </div>
              <button
                onClick={() => setSaved((s) => toggle(s, p.id))}
                aria-label="Save post"
                className={`neu-btn grid size-9 place-items-center rounded-xl ${saved.has(p.id) ? "!text-yellow" : "text-muted"}`}
              >
                <Bookmark className={`size-4 ${saved.has(p.id) ? "fill-current" : ""}`} />
              </button>
            </header>

            <p className="mt-4 text-sm leading-relaxed">{p.text}</p>

            <div className="neu-inset-sm mt-4 flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <Crest team={m.home} className="size-6" />
              <span className="text-sm font-semibold">{m.home.name}</span>
              <span className="text-xs text-muted">vs</span>
              <Crest team={m.away} className="size-6" />
              <span className="text-sm font-semibold">{m.away.name}</span>
              <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">{p.pick}</span>
            </div>

            <footer className="mt-4 flex items-center gap-2 text-sm text-muted">
              <button
                onClick={() => setLiked((s) => toggle(s, p.id))}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition hover:bg-danger/10 hover:text-danger ${isLiked ? "text-danger" : ""}`}
              >
                <Heart className={`size-4 transition-transform ${isLiked ? "scale-125 fill-current" : ""}`} />
                {p.likes + (isLiked ? 1 : 0)}
              </button>
              <button className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition hover:bg-primary/10 hover:text-primary">
                <MessageCircle className="size-4" /> {p.comments}
              </button>
              <button className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition hover:bg-primary/10 hover:text-primary">
                <Share2 className="size-4" /> Share
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
