import Image from "next/image";

type LogoProps = {
  variant?: "full" | "icon";
  className?: string;
  priority?: boolean;
};

/**
 * The full logo has navy lettering, which disappears on the dark theme,
 * so dark mode swaps in the icon plus a light wordmark.
 */
export function Logo({ variant = "full", className = "", priority }: LogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src="/brand/logo-icon.png"
        alt="Zoiko Sports"
        width={48}
        height={48}
        priority={priority}
        className={`rounded-xl ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/brand/logo-full.png"
        alt="Zoiko Sports"
        width={2806}
        height={935}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <div className="hidden h-full items-center gap-2.5 dark:flex">
        <Image src="/brand/logo-icon.png" alt="" width={48} height={48} className="h-full w-auto rounded-xl" />
        <div className="font-display leading-none">
          <div className="text-[1.35em] font-extrabold tracking-wide text-white">ZOIKO</div>
          <div className="text-[0.8em] font-bold tracking-[0.35em] text-primary">SPORTS</div>
        </div>
      </div>
    </div>
  );
}
