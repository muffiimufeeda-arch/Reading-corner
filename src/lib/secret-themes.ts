export type SecretThemeId = "instagram" | "emerald" | "dark";

export type SecretThemeTokens = {
  id: SecretThemeId;
  name: string;
  description: string;
  isDark: boolean;
  pageBg: string;
  ambientBackdrop: string;
  glassOrbPrimary: string;
  glassOrbSecondary: string;
  surface: string;
  surfaceGlass: string;
  glassSheet: string;
  glassRow: string;
  glassRowSelected: string;
  glassPill: string;
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
    description: "Luminous frosted daylight glass with warm sunset-to-cobalt glow.",
    isDark: false,
    pageBg: "bg-gradient-to-br from-[#dce9ff] via-[#f4edff] to-[#ffeef6] text-[#111827]",
    ambientBackdrop:
      "bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.28),transparent_48%),radial-gradient(circle_at_85%_20%,rgba(221,42,123,0.22),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(245,133,41,0.18),transparent_50%)]",
    glassOrbPrimary: "bg-gradient-to-tr from-[#3b82f6]/35 via-[#818cf8]/30 to-[#dd2a7b]/25",
    glassOrbSecondary: "bg-gradient-to-tr from-[#f58529]/25 via-[#ec4899]/25 to-[#60a5fa]/35",
    surface: "bg-white/92 text-[#111827]",
    surfaceGlass:
      "bg-white/74 backdrop-blur-2xl text-[#111827] border-white/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_16px_42px_-14px_rgba(59,130,246,0.28)]",
    glassSheet:
      "bg-white/62 backdrop-blur-2xl border-white/80 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.95),0_-12px_36px_-12px_rgba(59,130,246,0.22)]",
    glassRow:
      "bg-white/78 hover:bg-white/95 border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_-10px_rgba(59,130,246,0.22)]",
    glassRowSelected:
      "bg-gradient-to-r from-[#eff6ff]/95 via-white/95 to-[#fdf2f8]/95 border-[#93c5fd]/80 shadow-[0_10px_24px_-10px_rgba(59,130,246,0.38)]",
    glassPill:
      "bg-white/84 backdrop-blur-xl border-white/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_8px_20px_-8px_rgba(37,99,235,0.26)]",
    surfaceMuted: "bg-[#eef3ff]/90 text-[#111827]",
    border: "border-white/75",
    text: "text-[#111827]",
    mutedText: "text-[#515c74]",
    accentBg:
      "bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-[0_10px_24px_-6px_rgba(221,42,123,0.48)]",
    accentText: "text-[#dd2a7b]",
    ringGradient: "bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af]",
    myBubble:
      "border border-white/40 bg-gradient-to-br from-[#6366f1] via-[#dd2a7b] to-[#f58529] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_10px_24px_-8px_rgba(221,42,123,0.45)]",
    peerBubble:
      "bg-white/90 backdrop-blur-xl border border-white/90 text-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_6px_18px_-8px_rgba(30,41,59,0.16)]",
    navBg:
      "bg-white/78 border-white/85 text-[#515c74] shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_-8px_32px_-10px_rgba(59,130,246,0.22)]",
    navActiveBg:
      "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-[0_8px_20px_-4px_rgba(221,42,123,0.5)]",
    navActiveText: "text-white",
    badgeBg: "bg-gradient-to-r from-[#f58529] to-[#dd2a7b] text-white",
    cardShadow: "shadow-[0_14px_34px_-12px_rgba(59,130,246,0.24)]",
    swatches: ["#f58529", "#dd2a7b", "#8134af"],
  },
  emerald: {
    id: "emerald",
    name: "Emerald",
    description: "Fresh emerald green, frosted crystal white glass, and warm orange accents.",
    isDark: false,
    pageBg: "bg-gradient-to-br from-[#ddf7ea] via-[#f1fbf6] to-[#fff1e2] text-[#064e3b]",
    ambientBackdrop:
      "bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,0.28),transparent_48%),radial-gradient(circle_at_85%_20%,rgba(249,115,22,0.2),transparent_45%)]",
    glassOrbPrimary: "bg-gradient-to-tr from-[#10b981]/32 via-[#34d399]/28 to-[#f97316]/20",
    glassOrbSecondary: "bg-gradient-to-tr from-[#f97316]/24 via-[#10b981]/24 to-[#6ee7b7]/30",
    surface: "bg-white/92 text-[#064e3b]",
    surfaceGlass:
      "bg-white/74 backdrop-blur-2xl text-[#064e3b] border-white/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_16px_42px_-14px_rgba(5,150,105,0.24)]",
    glassSheet:
      "bg-white/62 backdrop-blur-2xl border-white/85 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.95),0_-12px_36px_-12px_rgba(5,150,105,0.2)]",
    glassRow:
      "bg-white/78 hover:bg-white/95 border-[#d3f2e3] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_-10px_rgba(5,150,105,0.2)]",
    glassRowSelected:
      "bg-gradient-to-r from-[#ecfdf5]/95 via-white/95 to-[#fff7ed]/95 border-[#6ee7b7]/80 shadow-[0_10px_24px_-10px_rgba(5,150,105,0.34)]",
    glassPill:
      "bg-white/84 backdrop-blur-xl border-[#d3f2e3] shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_8px_20px_-8px_rgba(5,150,105,0.22)]",
    surfaceMuted: "bg-[#e7f6ee]/90 text-[#064e3b]",
    border: "border-[#cbead9]",
    text: "text-[#064e3b]",
    mutedText: "text-[#2c6e56]",
    accentBg:
      "bg-gradient-to-r from-[#059669] to-[#f97316] text-white shadow-[0_10px_24px_-6px_rgba(5,150,105,0.44)]",
    accentText: "text-[#059669]",
    ringGradient: "bg-gradient-to-tr from-[#059669] via-[#10b981] to-[#f97316]",
    myBubble:
      "border border-white/35 bg-gradient-to-br from-[#059669] to-[#10b981] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_10px_24px_-8px_rgba(5,150,105,0.42)]",
    peerBubble:
      "bg-white/90 backdrop-blur-xl border border-[#d6efe1] text-[#064e3b] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_6px_18px_-8px_rgba(6,78,59,0.14)]",
    navBg:
      "bg-white/80 border-[#d6efe1] text-[#2c6e56] shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_-8px_32px_-10px_rgba(6,78,59,0.16)]",
    navActiveBg:
      "bg-gradient-to-r from-[#059669] to-[#f97316] text-white shadow-[0_8px_20px_-4px_rgba(5,150,105,0.45)]",
    navActiveText: "text-white",
    badgeBg: "bg-[#f97316] text-white",
    cardShadow: "shadow-[0_14px_34px_-12px_rgba(5,150,105,0.22)]",
    swatches: ["#059669", "#ffffff", "#f97316"],
  },
  dark: {
    id: "dark",
    name: "Dark",
    description: "Obsidian smoked glass with neon cobalt and luminous cherry-red rim glow.",
    isDark: true,
    pageBg: "bg-gradient-to-b from-[#060913] via-[#0c1324] to-[#07090f] text-[#f4f4f5]",
    ambientBackdrop:
      "bg-[radial-gradient(circle_at_20%_12%,rgba(225,29,72,0.24),transparent_46%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.24),transparent_48%),radial-gradient(circle_at_50%_85%,rgba(37,99,235,0.16),transparent_52%)]",
    glassOrbPrimary: "bg-gradient-to-tr from-[#2563eb]/32 via-[#e11d48]/26 to-[#4f46e5]/25",
    glassOrbSecondary: "bg-gradient-to-tr from-[#e11d48]/24 via-[#2563eb]/24 to-[#06b6d4]/22",
    surface: "bg-[#141927]/92 text-[#f4f4f5]",
    surfaceGlass:
      "bg-[#101626]/74 backdrop-blur-2xl text-[#f4f4f5] border-[#3b82f6]/28 shadow-[inset_0_1px_1px_rgba(255,255,255,0.16),0_18px_46px_-12px_rgba(37,99,235,0.34)]",
    glassSheet:
      "bg-[#0d1220]/76 backdrop-blur-2xl border-[#3b82f6]/30 shadow-[inset_0_1.5px_1px_rgba(147,197,253,0.25),0_-14px_40px_-10px_rgba(37,99,235,0.32)]",
    glassRow:
      "bg-[#171f33]/70 hover:bg-[#1e2942]/85 border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_20px_-10px_rgba(0,0,0,0.55)]",
    glassRowSelected:
      "bg-gradient-to-r from-[#e11d48]/24 via-[#1c253d]/90 to-[#2563eb]/24 border-rose-400/45 shadow-[0_0_24px_-6px_rgba(225,29,72,0.45)]",
    glassPill:
      "bg-[#141c2e]/84 backdrop-blur-xl border-[#3b82f6]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_8px_24px_-8px_rgba(37,99,235,0.38)]",
    surfaceMuted: "bg-[#1a2235]/90 text-[#f4f4f5]",
    border: "border-[#2b3752]",
    text: "text-[#f4f4f5]",
    mutedText: "text-[#9ca7bf]",
    accentBg:
      "bg-gradient-to-r from-[#e11d48] to-[#9f1239] text-white shadow-[0_0_24px_-4px_rgba(225,29,72,0.58)]",
    accentText: "text-[#fb7185]",
    ringGradient: "bg-gradient-to-tr from-[#e11d48] via-[#fb7185] to-[#3b82f6]",
    myBubble:
      "border border-rose-400/45 bg-gradient-to-br from-[#be123c]/90 to-[#881337]/95 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),0_0_24px_-6px_rgba(225,29,72,0.5)]",
    peerBubble:
      "bg-[#1c2436]/84 backdrop-blur-xl border border-white/14 text-[#f4f4f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_20px_-8px_rgba(0,0,0,0.5)]",
    navBg:
      "bg-[#0e1422]/82 border-[#3b82f6]/25 text-[#9ca7bf] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_-10px_34px_-10px_rgba(0,0,0,0.7)]",
    navActiveBg:
      "bg-gradient-to-r from-[#e11d48] to-[#be123c] text-white shadow-[0_0_22px_-4px_rgba(225,29,72,0.62)]",
    navActiveText: "text-white",
    badgeBg: "bg-[#e11d48] text-white",
    cardShadow: "shadow-[0_14px_36px_-12px_rgba(225,29,72,0.3)]",
    swatches: ["#09090b", "#27272a", "#e11d48"],
  },
};

export function getSecretTheme(id?: string | null): SecretThemeTokens {
  if (id === "emerald") return SECRET_THEMES.emerald;
  if (id === "dark") return SECRET_THEMES.dark;
  return SECRET_THEMES.instagram;
}
