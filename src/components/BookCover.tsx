import type { Book } from "@/lib/books";
import { categoryBySlug } from "@/lib/catalog";
import { cn } from "@/lib/utils";

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type PaletteVariant = {
  from: string;
  mid: string;
  to: string;
  accent: string;
  ink: string;
};

const CATEGORY_ACCENTS: Record<string, string[]> = {
  mystery: ["#fbbf24", "#93c5fd", "#fca5a5", "#cbd5e1"],
  romance: ["#fda4af", "#fde68a", "#f9a8d4", "#fed7aa"],
  adventure: ["#38bdf8", "#fbbf24", "#6ee7b7", "#fca5a5"],
  science: ["#5eead4", "#93c5fd", "#c4b5fd", "#fde047"],
  psychology: ["#f0abfc", "#93c5fd", "#fcd34d", "#fda4af"],
  history: ["#fcd34d", "#fdba74", "#d6d3d1", "#fca5a5"],
  biography: ["#a5b4fc", "#fcd34d", "#f9a8d4", "#6ee7b7"],
  education: ["#93c5fd", "#fde047", "#6ee7b7", "#f9a8d4"],
  technology: ["#67e8f9", "#818cf8", "#34d399", "#fbbf24"],
  cybersecurity: ["#34d399", "#22d3ee", "#fb7185", "#a3e635"],
  religion: ["#fde68a", "#bef264", "#99f6e4", "#fed7aa"],
  children: ["#fdba74", "#fde047", "#7dd3fc", "#f9a8d4"],
  "self-development": ["#86efac", "#fde047", "#fdba74", "#67e8f9"],
  business: ["#fde047", "#93c5fd", "#fca5a5", "#a7f3d0"],
  literature: ["#e9d5ff", "#fde68a", "#fda4af", "#bae6fd"],
  fiction: ["#c4b5fd", "#fbcfe8", "#fde68a", "#99f6e4"],
};

function resolvePalette(book: Partial<Book>): PaletteVariant {
  const hash = hashString(`${book.id ?? "fallback"}-${book.title ?? "book"}`);
  const accents = CATEGORY_ACCENTS[book.category ?? "fiction"] ?? CATEGORY_ACCENTS["fiction"]!;
  const accent = accents[hash % accents.length]!;
  const from = book.cover?.from ?? "#1e293b";
  const to = book.cover?.to ?? "#334155";
  const ink = book.cover?.ink ?? "#f8fafc";
  return {
    from,
    mid: to,
    to: from,
    accent,
    ink,
  };
}

function CategoryPosterArtwork({
  category,
  seed,
  accent,
  ink,
}: {
  category: string;
  seed: number;
  accent: string;
  ink: string;
}) {
  const flip = seed % 2 === 1 ? -1 : 1;
  const shiftX = ((seed >> 3) % 18) - 9;
  const shiftY = ((seed >> 6) % 14) - 7;
  const rot = ((seed >> 9) % 24) - 12;

  switch (category) {
    case "mystery":
      return (
        <g opacity="0.9">
          {/* Illuminated keyhole + foggy detective arch */}
          <path d={`M ${100 + shiftX} 56 L 144 210 L 56 210 Z`} fill={accent} opacity="0.16" />
          <circle
            cx={100 + shiftX}
            cy={112 + shiftY}
            r="36"
            fill="none"
            stroke={accent}
            strokeWidth="1.4"
            opacity="0.55"
          />
          <circle cx={100 + shiftX} cy={112 + shiftY} r="22" fill={accent} opacity="0.22" />
          <path
            d={`M ${94 + shiftX} ${126 + shiftY} L ${90 + shiftX} ${164 + shiftY} L ${110 + shiftX} ${164 + shiftY} L ${106 + shiftX} ${126 + shiftY} Z`}
            fill={ink}
            opacity="0.82"
          />
          <circle cx={100 + shiftX} cy={112 + shiftY} r="13" fill={ink} opacity="0.86" />
          <path
            d="M24 196 Q 100 176 176 196"
            fill="none"
            stroke={accent}
            strokeWidth="1.2"
            opacity="0.4"
          />
        </g>
      );
    case "romance":
      return (
        <g opacity="0.92">
          {/* Arch window & botanical stems with dusk sun */}
          <circle cx={100 + shiftX} cy={118 + shiftY} r="38" fill={accent} opacity="0.34" />
          <circle
            cx={100 + shiftX * -1}
            cy={118 - shiftY}
            r="26"
            fill="none"
            stroke={ink}
            strokeWidth="1.2"
            opacity="0.5"
          />
          <path
            d="M46 212 C 58 156, 94 128, 100 84 C 106 128, 142 156, 154 212"
            fill="none"
            stroke={ink}
            strokeWidth="1.5"
            opacity="0.65"
          />
          <ellipse
            cx={82}
            cy={142}
            rx="14"
            ry="7"
            transform={`rotate(-32 82 142)`}
            fill={accent}
            opacity="0.55"
          />
          <ellipse
            cx={118}
            cy={136}
            rx="14"
            ry="7"
            transform={`rotate(32 118 136)`}
            fill={accent}
            opacity="0.55"
          />
          <ellipse cx={100} cy={104} rx="10" ry="16" fill={ink} opacity="0.32" />
        </g>
      );
    case "adventure":
      return (
        <g opacity="0.92">
          {/* Compass rose & mountain/ocean horizon */}
          <circle
            cx="100"
            cy="116"
            r="46"
            fill="none"
            stroke={accent}
            strokeWidth="1.2"
            strokeDasharray="3 4"
            opacity="0.55"
          />
          <polygon
            points="100,66 108,108 150,116 108,124 100,166 92,124 50,116 92,108"
            fill={accent}
            opacity="0.4"
          />
          <polygon
            points="100,78 104,112 138,116 104,120 100,154 96,120 62,116 96,108"
            fill={ink}
            opacity="0.82"
          />
          <path
            d="M 18 192 L 62 152 L 96 180 L 136 142 L 182 192"
            fill="none"
            stroke={ink}
            strokeWidth="1.6"
            opacity="0.5"
          />
        </g>
      );
    case "science":
      return (
        <g opacity="0.92">
          {/* Planetary orbital rings & prism */}
          <ellipse
            cx="100"
            cy="122"
            rx="64"
            ry="22"
            transform={`rotate(${28 + rot} 100 122)`}
            fill="none"
            stroke={accent}
            strokeWidth="1.5"
            opacity="0.65"
          />
          <ellipse
            cx="100"
            cy="122"
            rx="64"
            ry="22"
            transform={`rotate(${-34 + rot} 100 122)`}
            fill="none"
            stroke={ink}
            strokeWidth="1.2"
            opacity="0.55"
          />
          <circle cx="100" cy="122" r="22" fill={accent} opacity="0.42" />
          <circle cx="100" cy="122" r="12" fill={ink} opacity="0.85" />
          <circle cx={148} cy={92} r="5" fill={accent} opacity="0.9" />
          <circle cx={56} cy={148} r="4" fill={ink} opacity="0.8" />
        </g>
      );
    case "psychology":
      return (
        <g opacity="0.9">
          {/* Concentric mind ripples & golden eye */}
          {[52, 40, 28, 16].map((r, i) => (
            <circle
              key={r}
              cx={100 + (i % 2 === 0 ? shiftX * 0.4 : -shiftX * 0.4)}
              cy={124}
              r={r}
              fill="none"
              stroke={i % 2 === 0 ? accent : ink}
              strokeWidth="1.4"
              opacity={0.28 + i * 0.14}
            />
          ))}
          <path d="M46 124 Q 100 84 154 124 Q 100 164 46 124 Z" fill={accent} opacity="0.25" />
          <circle cx="100" cy="124" r="9" fill={ink} opacity="0.86" />
        </g>
      );
    case "cybersecurity":
    case "technology":
      return (
        <g opacity="0.9">
          {/* Cryptographic hexagonal cipher rings & shield */}
          <polygon
            points="100,72 142,96 142,144 100,168 58,144 58,96"
            fill={accent}
            opacity="0.16"
            stroke={accent}
            strokeWidth="1.5"
          />
          <polygon
            points="100,88 128,104 128,136 100,152 72,136 72,104"
            fill="none"
            stroke={ink}
            strokeWidth="1.3"
            opacity="0.7"
          />
          <circle cx="100" cy="120" r="10" fill={accent} opacity="0.85" />
          <path
            d="M36 120 H 64 M 136 120 H 164 M 100 54 V 80 M 100 160 V 186"
            stroke={ink}
            strokeWidth="1.2"
            opacity="0.45"
          />
        </g>
      );
    case "history":
    case "religion":
      return (
        <g opacity="0.9">
          {/* Classical arch & sunburst geometric rosette */}
          <path
            d="M56 184 V 116 A 44 44 0 0 1 144 116 V 184"
            fill="none"
            stroke={accent}
            strokeWidth="1.8"
            opacity="0.65"
          />
          <path d="M70 184 V 120 A 30 30 0 0 1 130 120 V 184" fill={accent} opacity="0.18" />
          <circle cx="100" cy="108" r="18" fill={ink} opacity="0.78" />
          <circle
            cx="100"
            cy="108"
            r="26"
            fill="none"
            stroke={accent}
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity="0.75"
          />
        </g>
      );
    case "children":
      return (
        <g opacity="0.95">
          {/* Playful crescent moon, hot air balloon & stars */}
          <circle cx={102 + shiftX} cy={112} r="32" fill={accent} opacity="0.65" />
          <path
            d={`M ${90 + shiftX} 144 L ${114 + shiftX} 144 L ${108 + shiftX} 162 L ${96 + shiftX} 162 Z`}
            fill={ink}
            opacity="0.75"
          />
          <circle cx="56" cy="88" r="4" fill={ink} opacity="0.75" />
          <circle cx="152" cy="96" r="5" fill={accent} opacity="0.85" />
          <circle cx="144" cy="158" r="3" fill={ink} opacity="0.7" />
          <path
            d="M32 184 Q 100 162 168 184"
            fill="none"
            stroke={ink}
            strokeWidth="1.5"
            opacity="0.45"
          />
        </g>
      );
    case "business":
    case "self-development":
    case "education":
      return (
        <g opacity="0.92">
          {/* Rising architectural monoliths & sunburst */}
          <circle cx="100" cy="102" r="34" fill={accent} opacity="0.32" />
          <rect x="52" y="138" width="22" height="52" rx="3" fill={ink} opacity="0.32" />
          <rect x="89" y="114" width="22" height="76" rx="3" fill={ink} opacity="0.55" />
          <rect x="126" y="88" width="22" height="102" rx="3" fill={accent} opacity="0.68" />
        </g>
      );
    default:
      return (
        <g opacity="0.9">
          {/* Modernist literary geometric medallion & asymmetric horizon */}
          <circle cx={100 + shiftX * flip} cy={118 + shiftY} r="44" fill={accent} opacity="0.28" />
          <circle
            cx={100 - shiftX * 0.5}
            cy={118 - shiftY * 0.5}
            r="34"
            fill="none"
            stroke={ink}
            strokeWidth="1.4"
            opacity="0.65"
          />
          <rect
            x="76"
            y="94"
            width="48"
            height="48"
            transform={`rotate(${45 + rot} 100 118)`}
            fill="none"
            stroke={accent}
            strokeWidth="1.4"
            opacity="0.75"
          />
          <circle cx="100" cy="118" r="8" fill={ink} opacity="0.85" />
        </g>
      );
  }
}

export function BookCover({
  book,
  className,
  size = "md",
}: {
  book: Partial<Book> & { id: string; title: string; author: string };
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const palette = resolvePalette(book);
  const seed = hashString(`${book.id}:${book.title}`);
  const cat = book.category ? categoryBySlug(book.category) : undefined;
  const yearLabel =
    book.year !== undefined
      ? book.year < 0
        ? `${Math.abs(book.year)} BCE`
        : String(book.year)
      : null;

  const isCompact = size === "sm";
  const isLarge = size === "lg";
  const gradId = `cov-${book.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${size}`;

  return (
    <div
      className={cn(
        "relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-xl shadow-book select-none",
        isLarge ? "rounded-2xl p-4 sm:p-5" : isCompact ? "rounded-lg p-2" : "rounded-xl p-3",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(155deg, ${palette.from} 0%, ${palette.mid} 100%)`,
        color: palette.ink,
      }}
    >
      {/* Bespoke Category Poster Artwork Layer */}
      <svg
        viewBox="0 0 200 300"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={palette.from} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="300" fill={`url(#${gradId})`} />
        <CategoryPosterArtwork
          category={book.category ?? "fiction"}
          seed={seed}
          accent={palette.accent}
          ink={palette.ink}
        />
        {/* Crisp Editorial Border Frame */}
        <rect
          x="14"
          y="12"
          width="174"
          height="276"
          rx="6"
          fill="none"
          stroke={palette.ink}
          strokeOpacity="0.22"
          strokeWidth="1"
        />
      </svg>

      {/* Book Spine & Subtle Paper Gloss */}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[6%]"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.34) 0%, rgba(255,255,255,0.12) 60%, rgba(0,0,0,0) 100%)",
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.04) 42%, rgba(0,0,0,0.44) 100%)",
        }}
        aria-hidden
      />

      {/* Top Poster Title Zone */}
      <div className={cn("relative z-10", isCompact ? "pl-1" : "pl-2")}>
        {!isCompact && (
          <p
            className="mb-1 truncate text-[8px] font-bold uppercase tracking-[0.2em] opacity-80 sm:text-[9px]"
            style={{ color: palette.accent }}
          >
            {cat?.name ?? "Edition"}
          </p>
        )}
        <p
          className={cn(
            "font-display font-bold leading-[1.12] tracking-tight drop-shadow-sm",
            isLarge
              ? "line-clamp-3 text-lg sm:text-xl"
              : isCompact
                ? "line-clamp-2 text-[9px]"
                : "line-clamp-3 text-xs sm:text-sm",
          )}
        >
          {book.title}
        </p>
      </div>

      {/* Bottom Author & Edition Rule Zone */}
      <div className={cn("relative z-10", isCompact ? "pl-1" : "pl-2")}>
        <div
          className={cn("mb-1.5 h-px", isCompact ? "w-4" : "w-8")}
          style={{ background: palette.accent, opacity: 0.75 }}
        />
        <p
          className={cn(
            "truncate font-semibold uppercase tracking-[0.12em] opacity-90",
            isCompact ? "text-[7px]" : isLarge ? "text-[11px]" : "text-[9px] sm:text-[10px]",
          )}
        >
          {book.author}
        </p>
        {isLarge && yearLabel && (
          <p className="mt-0.5 text-[9px] font-medium tracking-wider opacity-65">{yearLabel}</p>
        )}
      </div>
    </div>
  );
}
