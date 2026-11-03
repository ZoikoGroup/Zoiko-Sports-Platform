import { useId } from "react";

/** Vector version of the ball in the Zoiko Sports logo. */
export function BrandBall({ className = "", stripe = "#fdcf22" }: { className?: string; stripe?: string }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="46" fill="#25163a" />
      <g clipPath={`url(#${clip})`} fill="none" stroke={stripe} strokeWidth="9" strokeLinecap="round">
        <path d="M24 2 C 8 22, 36 34, 60 45 C 84 56, 100 62, 96 82" />
        <path d="M2 34 C -2 56, 26 64, 50 74 C 70 82, 82 90, 70 104" />
      </g>
      <circle cx="36" cy="30" r="16" fill="white" opacity="0.08" />
    </svg>
  );
}
