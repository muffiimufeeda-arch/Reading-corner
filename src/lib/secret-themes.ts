export type SecretThemeId = "instagram" | "emerald" | "dark";

export type SecretThemeTokens = {
  id: SecretThemeId;
  name: string;
  description: string;
  isDark: boolean;
  pageBg: string;
  ambientBackdrop: string;
  surface: string;
  surfaceGlass: string;
  surfaceMuted: string;
  border: string;
  text: string;
  mutedText: string;
  accentBg: string;
  accentText: string;
  ringGradient: string;
  myBubble: string;
  peerBubble: string;
  navBg: string;
  navActiveBg: string;
  navActiveText: string;
  badgeBg: string;
  cardShadow: string;
  swatches: [string, string, string];
};

export const SECRET_THEMES: Record<SecretThemeId, SecretThemeTokens> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    description: "Luminous daylight gradient glass with warm sunset-to-violet accents.",
    isDark: false,
    pageBg: "bg-gradient-to-br from-[#eaf1ff] via-[#f8edff] to-[#fff1eb] text-[#111827]",
    ambientBackdrop:
      "bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.22),transparent_48%),radial-gradient(circle_at_85%_20%,rgba(221,42,123,0.18),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(245,133,41,0.16),transparent_50%)]",
    surface: "bg-white/92 text-[#111827]",
    surfaceGlass:
      "bg-white/80 backdrop-blur-xl text-[#111827] border-white/80 shadow-[0_14px_38px_-14px_rgba(79,70,229,0.22)]",
    surfaceMuted: "bg-[#f1f4fb]/90 text-[#111827]",
    border: "border-[#e2e8f5]",
    text: "text-[#111827]",
    mutedText: "text-[#5b6478]",
    accentBg:
      "bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-[0_8px_20px_-6px_rgba(221,42,123,0.45)]",
    accentText: "text-[#dd2a7b]",
    ringGradient: "bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af]",
    myBubble:
      "bg-gradient-to-br from-[#6366f1] via-[#dd2a7b] to-[#f58529] text-white shadow-[0_8px_18px_-6px_rgba(221,42,123,0.4)]",
    peerBubble: "bg-white/95 border border-white text-[#111827] shadow-sm",
    navBg:
      "bg-white/88 border-white/80 text-[#5b6478] shadow-[0_-6px_28px_-10px_rgba(30,41,59,0.16)]",
    navActiveBg: "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-md",
    navActiveText: "text-white",
    badgeBg: "bg-gradient-to-r from-[#f58529] to-[#dd2a7b] text-white",
    cardShadow: "shadow-[0_10px_28px_-12px_rgba(59,130,246,0.22)]",
    swatches: ["#f58529", "#dd2a7b", "#8134af"],
  },
  emerald: {
    id: "emerald",
    name: "Emerald",
    description: "Fresh emerald green, crisp frosted white glass, and warm orange accents.",
    isDark: false,
    pageBg: "bg-gradient-to-br from-[#e7f9f0] via-[#f4fbf7] to-[#fff4e6] text-[#064e3b]",
    ambientBackdrop:
      "bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,0.22),transparent_48%),radial-gradient(circle_at_85%_20%,rgba(249,115,22,0.16),transparent_45%)]",
    surface: "bg-white/92 text-[#064e3b]",
    surfaceGlass:
      "bg-white/82 backdrop-blur-xl text-[#064e3b] border-white/85 shadow-[0_14px_38px_-14px_rgba(5,150,105,0.2)]",
    surfaceMuted: "bg-[#e7f6ee]/90 text-[#064e3b]",
    border: "border-[#cbead9]",
    text: "text-[#064e3b]",
    mutedText: "text-[#2c6e56]",
    accentBg:
      "bg-gradient-to-r from-[#059669] to-[#f97316] text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.4)]",
    accentText: "text-[#059669]",
    ringGradient: "bg-gradient-to-tr from-[#059669] via-[#10b981] to-[#f97316]",
    myBubble:
      "bg-gradient-to-br from-[#059669] to-[#10b981] text-white shadow-[0_8px_18px_-6px_rgba(5,150,105,0.38)]",
    peerBubble: "bg-white/95 border border-[#d6efe1] text-[#064e3b] shadow-sm",
    navBg:
      "bg-white/88 border-[#d6efe1] text-[#2c6e56] shadow-[0_-6px_28px_-10px_rgba(6,78,59,0.14)]",
    navActiveBg: "bg-gradient-to-r from-[#059669] to-[#f97316] text-white shadow-md",
    navActiveText: "text-white",
    badgeBg: "bg-[#f97316] text-white",
    cardShadow: "shadow-[0_10px_28px_-12px_rgba(5,150,105,0.2)]",
    swatches: ["#059669", "#ffffff", "#f97316"],
  },
  dark: {
    id: "dark",
    name: "Dark",
    description: "Obsidian black, charcoal slate glass, and luminous cherry red highlights.",
    isDark: true,
    pageBg: "bg-gradient-to-b from-[#07090f] via-[#0c101b] to-[#08090d] text-[#f4f4f5]",
    ambientBackdrop:
      "bg-[radial-gradient(circle_at_20%_12%,rgba(225,29,72,0.2),transparent_46%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.16),transparent_48%)]",
    surface: "bg-[#141824]/92 text-[#f4f4f5]",
    surfaceGlass:
      "bg-[#121622]/82 backdrop-blur-xl text-[#f4f4f5] border-[#293246]/80 shadow-[0_14px_42px_-12px_rgba(225,29,72,0.26)]",
    surfaceMuted: "bg-[#1f2636]/90 text-[#f4f4f5]",
    border: "border-[#2a3142]",
    text: "text-[#f4f4f5]",
    mutedText: "text-[#9ca3b5]",
    accentBg:
      "bg-gradient-to-r from-[#e11d48] to-[#9f1239] text-white shadow-[0_8px_22px_-6px_rgba(225,29,72,0.5)]",
    accentText: "text-[#fb7185]",
    ringGradient: "bg-gradient-to-tr from-[#e11d48] via-[#fb7185] to-[#52525b]",
    myBubble:
      "border border-rose-400/35 bg-gradient-to-br from-[#be123c]/90 to-[#881337]/95 text-white shadow-[0_8px_22px_-6px_rgba(225,29,72,0.45)]",
    peerBubble: "bg-[#1c2231]/90 border border-white/10 text-[#f4f4f5] shadow-sm",
    navBg:
      "bg-[#10141f]/90 border-[#283044] text-[#9ca3b5] shadow-[0_-8px_32px_-10px_rgba(0,0,0,0.65)]",
    navActiveBg: "bg-gradient-to-r from-[#e11d48] to-[#be123c] text-white shadow-md",
    navActiveText: "text-white",
    badgeBg: "bg-[#e11d48] text-white",
    cardShadow: "shadow-[0_12px_30px_-14px_rgba(225,29,72,0.28)]",
    swatches: ["#09090b", "#27272a", "#e11d48"],
  },
};

export function getSecretTheme(id?: string | null): SecretThemeTokens {
  if (id === "emerald") return SECRET_THEMES.emerald;
  if (id === "dark") return SECRET_THEMES.dark;
  return SECRET_THEMES.instagram;
}
