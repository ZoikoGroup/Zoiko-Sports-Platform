import { useId } from "react";
import type { Team } from "@/lib/data";

/** Generic two-tone shield standing in for a club badge. */
export function Crest({ team, className = "size-8" }: { team: Team; className?: string }) {
  const clip = useId();
  const [a, b] = team.colors;
  return (
    <svg viewBox="0 0 40 46" className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.18)]`} aria-label={team.name} role="img">
      <defs>
        <clipPath id={clip}>
          <path d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="40" height="46" fill={a} />
        <path d="M0 30 L40 14 V46 H0 Z" fill={b} opacity="0.9" />
      </g>
      <path d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <text x="20" y="25" textAnchor="middle" fontSize="9" fontWeight="800" fill="white" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5">
        {team.code}
      </text>
    </svg>
  );
}
