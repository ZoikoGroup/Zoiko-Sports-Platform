const GRADIENTS = [
  "from-[#3a7fb8] to-[#25163a]",
  "from-[#fdcf22] to-[#f08c00]",
  "from-[#7b5cff] to-[#3a7fb8]",
  "from-[#1fae6b] to-[#0f5f80]",
  "from-[#ff6b6f] to-[#9b2c66]",
  "from-[#25163a] to-[#5a3d8a]",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type AvatarProps = {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
};

const SIZES = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
};

export function Avatar({ name, size = "md", online, className = "" }: AvatarProps) {
  return (
    <span
      title={name}
      className={`relative inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ${
        GRADIENTS[hash(name) % GRADIENTS.length]
      } ${SIZES[size]} ${className}`}
    >
      {initials(name)}
      {online && (
        <span className="absolute bottom-0 right-0 size-[28%] rounded-full border-2 border-surface bg-success" />
      )}
    </span>
  );
}

export function AvatarStack({ names, size = "sm" }: { names: string[]; size?: AvatarProps["size"] }) {
  return (
    <div className="flex -space-x-2">
      {names.map((n) => (
        <Avatar
          key={n}
          name={n}
          size={size}
          className="ring-2 ring-surface transition-transform duration-300 hover:z-10 hover:-translate-y-1 hover:scale-110"
        />
      ))}
    </div>
  );
}
