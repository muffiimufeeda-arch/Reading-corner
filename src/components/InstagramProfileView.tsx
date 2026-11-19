import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Ban,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Eye,
  EyeOff,
  Film,
  Grid3X3,
  KeyRound,
  Library,
  LogOut,
  MessageCircle,
  Nfc,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  ShieldAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BookCover } from "@/components/BookCover";
import { MediaLightbox } from "@/components/InstagramChatView";
import { bookById } from "@/lib/books";
import {
  changePassword,
  fetchGallery,
  fetchNfcLink,
  initialsOf,
  loadBlocks,
  logout,
  regenerateNfcLink,
  revokeNfcLink,
  sendOtp,
  setSecretTheme,
  setSoundEnabled,
  unblockUser,
  updateMyProfile,
  uploadAvatar,
  uploadChatMedia,
  useChat,
  verifyMyPhoneOtp,
} from "@/lib/chat-store";
import { progressPercent, useLibrary } from "@/lib/library-store";
import { SECRET_THEMES, type SecretThemeId, type SecretThemeTokens } from "@/lib/secret-themes";
import { cn } from "@/lib/utils";

export type ProfileSection = "gallery" | "nfc" | "theme" | "settings";

export function InstagramProfileView({
  theme,
  initialSection = "gallery",
  onBackToChat,
}: {
  theme: SecretThemeTokens;
  initialSection?: ProfileSection;
  onBackToChat?: () => void;
}) {
  const navigate = useNavigate();
  const { me, nfc, gallery, blockedUsers, soundEnabled, otpConfigured } = useChat();
  const { state: libraryState, syncing: librarySyncing } = useLibrary();

  const [section, setSection] = useState<ProfileSection>(initialSection);
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [displayHandle, setDisplayHandle] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [revealNfcLink, setRevealNfcLink] = useState(false);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [writingNfc, setWritingNfc] = useState(false);

  const [lightbox, setLightbox] = useState<{
    url: string;
    kind: "image" | "video";
    name: string;
  } | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [verifyOtpCode, setVerifyOtpCode] = useState("");
  const [verifyOtpSent, setVerifyOtpSent] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (me) {
      setFullName(me.fullName);
      setDisplayHandle(me.displayHandle.replace(/^@/, ""));
      setBio(me.bio);
    }
  }, [me]);

  useEffect(() => {
    void Promise.all([fetchNfcLink(), fetchGallery(), loadBlocks()]);
  }, []);

  const continueBook = useMemo(() => {
    const entries = Object.entries(libraryState.progress).sort((a, b) =>
      b[1].updatedAt.localeCompare(a[1].updatedAt),
    );
    for (const [bookId, prog] of entries) {
      const book = bookById(bookId);
      if (book) return { book, prog };
    }
    return null;
  }, [libraryState.progress]);

  if (!me) return null;

  const personalUrl =
    typeof window !== "undefined" && nfc?.path ? `${window.location.origin}${nfc.path}` : null;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await uploadAvatar(file);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update photo.");
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await uploadChatMedia(file);
      await fetchGallery();
      toast.success("Added to your private gallery");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateMyProfile({ fullName, bio, displayHandle });
      setEditingProfile(false);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleCopyLink() {
    if (!personalUrl) return;
    try {
      await navigator.clipboard.writeText(personalUrl);
      toast.success("Personal link copied to clipboard");
    } catch {
      toast.error("Could not copy automatically. Reveal the link to copy manually.");
    }
  }

  async function handleShareLink() {
    if (!personalUrl) return;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${me?.fullName} — Reading Corner Card`,
          text: "Open my Reading Corner personal card link",
          url: personalUrl,
        });
        return;
      } catch {
        /* fallback to clipboard */
      }
    }
    await handleCopyLink();
  }

  async function handleWriteNfcTag() {
    if (!personalUrl) return;
    const w = window as unknown as {
      NDEFReader?: new () => {
        write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void>;
      };
    };
    if (!w.NDEFReader) {
      toast("Web NFC not available in this browser", {
        description:
          "Copy your NFC Card Link above and write it using NFC Tools on Android or iPhone.",
      });
      return;
    }
    setWritingNfc(true);
    try {
      const ndef = new w.NDEFReader();
      await ndef.write({ records: [{ recordType: "url", data: personalUrl }] });
      toast.success("NFC card written successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "NFC write canceled or unsupported.");
    } finally {
      setWritingNfc(false);
    }
  }

  async function handleRegenerateNfc() {
    setNfcBusy(true);
    try {
      await regenerateNfcLink();
      toast.success("New personal NFC link generated. Previous link invalidated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate link.");
    } finally {
      setNfcBusy(false);
    }
  }

  async function handleRevokeNfc() {
    setNfcBusy(true);
    try {
      await revokeNfcLink();
      toast.success("Lost NFC card revoked. No one can access your account with the old card.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke card.");
    } finally {
      setNfcBusy(false);
    }
  }

  async function handleThemeSelect(id: SecretThemeId) {
    try {
      await setSecretTheme(id);
      toast.success(`${SECRET_THEMES[id].name} theme saved`);
    } catch {
      toast.error("Could not save theme preference.");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setPwdBusy(true);
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setPwdBusy(false);
    }
  }

  async function handleSendPhoneVerifyOtp() {
    if (!me?.phoneE164) return;
    try {
      await sendOtp({ phone: me.phoneE164, countryCode: "+91", purpose: "verify_phone" });
      setVerifyOtpSent(true);
      toast.success("Verification code sent to your phone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send verification OTP.");
    }
  }

  async function handleConfirmPhoneOtp() {
    try {
      await verifyMyPhoneOtp(verifyOtpCode);
      setVerifyOtpCode("");
      setVerifyOtpSent(false);
      toast.success("Phone number verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 md:px-8 md:py-7 md:pb-10">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Top Profile Utility Bar with Back to Chat */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (onBackToChat) {
                onBackToChat();
              } else {
                navigate({ to: "/messages" });
              }
            }}
            className={cn(
              "inline-flex min-h-[42px] items-center gap-2 rounded-2xl border px-3.5 text-xs font-bold backdrop-blur-xl transition hover:scale-[1.01]",
              theme.surfaceGlass,
              theme.border,
              theme.cardShadow,
            )}
          >
            <ArrowLeft className="size-4" />
            <MessageCircle className="size-3.5" />
            <span>Back to Chat</span>
          </button>

          <Link
            to="/home"
            className={cn(
              "inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-bold backdrop-blur-xl transition hover:scale-[1.01]",
              theme.surfaceGlass,
              theme.border,
            )}
          >
            <BookOpen className="size-4" />
            <span>Reading Library</span>
          </Link>
        </div>

        {/* Instagram-style Glass Profile Header */}
        <div
          className={cn(
            "rounded-3xl border p-5 backdrop-blur-xl",
            theme.surfaceGlass,
            theme.border,
            theme.cardShadow,
          )}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Change profile photo"
              className="relative mx-auto shrink-0 sm:mx-0"
            >
              <span className={cn("block rounded-full p-[3px]", theme.ringGradient)}>
                <span
                  className={cn(
                    "grid size-24 place-items-center overflow-hidden rounded-full font-display text-2xl font-extrabold",
                    theme.surface,
                  )}
                >
                  {me.avatarUrl ? (
                    <img
                      src={me.avatarUrl}
                      alt={me.fullName}
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  ) : (
                    initialsOf(me.fullName)
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-2 border-white shadow",
                  theme.accentBg,
                )}
              >
                <Camera className="size-4" />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleAvatarChange(e)}
              className="hidden"
            />

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="truncate font-display text-2xl font-extrabold">{me.fullName}</h1>
                <span className={cn("text-xs font-semibold", theme.mutedText)}>
                  {me.displayHandle}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-xs sm:justify-start">
                <span className={cn("inline-flex items-center gap-1 font-medium", theme.mutedText)}>
                  <Phone className="size-3.5" />
                  {me.phoneE164 ?? me.phoneMasked}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-semibold",
                    me.phoneVerified ? "text-emerald-600" : "text-amber-600",
                  )}
                >
                  {me.phoneVerified ? (
                    <>
                      <CheckCircle2 className="size-3.5" /> Verified
                    </>
                  ) : (
                    "Unverified"
                  )}
                </span>
              </div>

              {me.bio && <p className="mt-2.5 text-sm leading-relaxed">{me.bio}</p>}

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={() => setEditingProfile((s) => !s)}
                  className={cn(
                    "min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition",
                    theme.surfaceMuted,
                  )}
                >
                  {editingProfile ? "Cancel Edit" : "Edit Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => setSection("nfc")}
                  className={cn(
                    "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition",
                    theme.accentBg,
                  )}
                >
                  <Nfc className="size-3.5" /> Personal NFC Link
                </button>
              </div>
            </div>
          </div>

          {editingProfile && (
            <form
              onSubmit={(e) => void handleSaveProfile(e)}
              className={cn("mt-5 space-y-3 border-t pt-5", theme.border)}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={cn("mb-1 block text-xs font-semibold", theme.mutedText)}>
                    Full Name
                  </span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                      theme.border,
                      theme.surfaceMuted,
                    )}
                  />
                </label>
                <label className="block">
                  <span className={cn("mb-1 block text-xs font-semibold", theme.mutedText)}>
                    Display Handle
                  </span>
                  <input
                    value={displayHandle}
                    onChange={(e) => setDisplayHandle(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                      theme.border,
                      theme.surfaceMuted,
                    )}
                  />
                </label>
              </div>
              <label className="block">
                <span className={cn("mb-1 block text-xs font-semibold", theme.mutedText)}>Bio</span>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={cn(
                    "w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                    theme.border,
                    theme.surfaceMuted,
                  )}
                />
              </label>
              <button
                type="submit"
                disabled={savingProfile}
                className={cn(
                  "min-h-[42px] rounded-xl px-5 py-2 text-xs font-bold",
                  theme.accentBg,
                )}
              >
                {savingProfile ? "Saving…" : "Save Personal Info"}
              </button>
            </form>
          )}
        </div>

        {/* Account-Synced My Reading Shelf */}
        <div
          className={cn(
            "rounded-3xl border p-5 backdrop-blur-xl",
            theme.surfaceGlass,
            theme.border,
            theme.cardShadow,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-extrabold">My Reading Corner Shelf</h2>
              <p className={cn("text-xs", theme.mutedText)}>
                {librarySyncing
                  ? "Syncing reading progress…"
                  : `${libraryState.favorites.length} favorites · ${libraryState.bookmarks.length} bookmarks · ${libraryState.completed.length} completed`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/explore"
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold",
                  theme.border,
                  theme.surfaceMuted,
                )}
              >
                <Compass className="size-3.5" /> Explore Books
              </Link>
              <Link
                to="/library"
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold",
                  theme.accentBg,
                )}
              >
                <Library className="size-3.5" /> Saved Library
              </Link>
            </div>
          </div>

          {continueBook && (
            <div
              className={cn(
                "mt-4 flex items-center gap-3.5 rounded-2xl border p-3",
                theme.border,
                theme.surfaceMuted,
              )}
            >
              <Link
                to="/book/$bookId"
                params={{ bookId: continueBook.book.id }}
                className="w-12 shrink-0"
              >
                <BookCover book={continueBook.book} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <p
                  className={cn("text-[10px] font-bold uppercase tracking-wider", theme.accentText)}
                >
                  Continue Reading ·{" "}
                  {progressPercent(continueBook.prog.page, continueBook.prog.pages)}%
                </p>
                <p className="truncate font-display text-sm font-extrabold">
                  {continueBook.book.title}
                </p>
                <p className={cn("truncate text-xs", theme.mutedText)}>
                  {continueBook.book.author} · Page {continueBook.prog.page + 1} of{" "}
                  {continueBook.prog.pages}
                </p>
              </div>
              <Link
                to="/read/$bookId"
                params={{ bookId: continueBook.book.id }}
                className={cn(
                  "inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold",
                  theme.accentBg,
                )}
              >
                <BookOpen className="size-3.5" /> Resume
              </Link>
            </div>
          )}
        </div>

        {/* Profile Sub-navigation (Gallery, NFC Card, Theme, Settings) */}
        <div
          className={cn(
            "grid grid-cols-4 gap-1.5 rounded-2xl border p-1.5 backdrop-blur-xl",
            theme.surfaceGlass,
            theme.border,
          )}
        >
          {(
            [
              { id: "gallery", label: "Gallery", icon: Grid3X3 },
              { id: "nfc", label: "NFC Card", icon: Nfc },
              { id: "theme", label: "Themes", icon: Palette },
              { id: "settings", label: "Settings", icon: Settings },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={cn(
                  "flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition",
                  active ? theme.accentBg : theme.mutedText,
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Section 1: Private Media Gallery */}
        {section === "gallery" && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-3xl border p-5 backdrop-blur-xl",
              theme.surfaceGlass,
              theme.border,
              theme.cardShadow,
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Gallery</h2>
                <p className={cn("text-xs", theme.mutedText)}>
                  Private photos and videos from your conversations and uploads.
                </p>
              </div>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className={cn(
                  "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold",
                  theme.accentBg,
                )}
              >
                <Plus className="size-4" /> Add Media
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => void handleGalleryUpload(e)}
                className="hidden"
              />
            </div>

            {gallery.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {gallery.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setLightbox({ url: item.url, kind: item.kind, name: item.originalName })
                    }
                    className="group relative aspect-square overflow-hidden rounded-xl bg-black/10"
                  >
                    {item.kind === "image" ? (
                      <img
                        src={item.url}
                        alt={item.originalName}
                        className="size-full object-cover transition duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <>
                        <video src={item.url} className="size-full object-cover" />
                        <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/65 text-white">
                          <Film className="size-3.5" />
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className={cn("mt-5 rounded-2xl p-8 text-center", theme.surfaceMuted)}>
                <Grid3X3 className={cn("mx-auto size-8 opacity-40", theme.mutedText)} />
                <p className="mt-2 text-sm font-bold">Your gallery is empty</p>
                <p className={cn("mt-1 text-xs", theme.mutedText)}>
                  Photos and videos you share in chat or upload here stay protected to your account.
                </p>
              </div>
            )}
          </motion.section>
        )}

        {/* Section 2: Personal NFC Card & Secret Link Management */}
        {section === "nfc" && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "space-y-4 rounded-3xl border p-5 backdrop-blur-xl",
              theme.surfaceGlass,
              theme.border,
              theme.cardShadow,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">NFC Card & Personal Link</h2>
                <p className={cn("mt-0.5 text-xs leading-relaxed", theme.mutedText)}>
                  Tap your NFC card to open Reading Corner. Signed-in devices open directly; other
                  devices must verify your phone number and password.
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-bold",
                  nfc?.revoked ? "text-rose-600" : "text-emerald-600",
                )}
              >
                {nfc?.revoked ? "Revoked" : `Active · v${nfc?.version ?? 1}`}
              </span>
            </div>

            {personalUrl && !nfc?.revoked ? (
              <div
                className={cn("space-y-3 rounded-2xl border p-4", theme.border, theme.surfaceMuted)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">My Personal Link</span>
                  <button
                    type="button"
                    onClick={() => setRevealNfcLink((r) => !r)}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold",
                      theme.accentText,
                    )}
                  >
                    {revealNfcLink ? (
                      <>
                        <EyeOff className="size-3.5" /> Hide URL
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> Reveal URL
                      </>
                    )}
                  </button>
                </div>

                <p className="break-all rounded-xl bg-black/5 px-3 py-2.5 font-mono text-xs">
                  {revealNfcLink
                    ? personalUrl
                    : `${window.location.origin}/nfc/••••••••••••••••••••`}
                </p>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className={cn(
                      "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold",
                      theme.surface,
                      theme.border,
                    )}
                  >
                    <Copy className="size-4" /> Copy Link
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareLink()}
                    className={cn(
                      "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold",
                      theme.surface,
                      theme.border,
                    )}
                  >
                    <Share2 className="size-4" /> Share Link
                  </button>
                  <button
                    type="button"
                    disabled={writingNfc}
                    onClick={() => void handleWriteNfcTag()}
                    className={cn(
                      "col-span-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold sm:col-span-1",
                      theme.accentBg,
                    )}
                  >
                    <Nfc className="size-4" /> {writingNfc ? "Hold NFC Tag…" : "NFC Card Link"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                <p className="font-bold">Card Revoked</p>
                <p className="mt-1">
                  Your previous NFC card link has been permanently disabled. Generate a new link
                  below when you have a replacement card.
                </p>
              </div>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={nfcBusy}
                onClick={() => void handleRegenerateNfc()}
                className={cn(
                  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold",
                  theme.surfaceMuted,
                )}
              >
                <RefreshCw className="size-4" /> Regenerate Link
              </button>
              <button
                type="button"
                disabled={nfcBusy || Boolean(nfc?.revoked)}
                onClick={() => void handleRevokeNfc()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                <ShieldAlert className="size-4" /> Revoke Lost Card
              </button>
            </div>
          </motion.section>
        )}

        {/* Section 3: Three Secret-Page Themes */}
        {section === "theme" && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "space-y-4 rounded-3xl border p-5 backdrop-blur-xl",
              theme.surfaceGlass,
              theme.border,
              theme.cardShadow,
            )}
          >
            <div>
              <h2 className="font-display text-lg font-bold">Secret Page Themes</h2>
              <p className={cn("text-xs", theme.mutedText)}>
                Saved to your account and synced across all your devices.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(SECRET_THEMES) as SecretThemeId[]).map((id) => {
                const t = SECRET_THEMES[id];
                const selected = me.theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void handleThemeSelect(id)}
                    className={cn(
                      "flex flex-col rounded-2xl border p-4 text-left transition",
                      selected ? "ring-2 ring-offset-1" : "opacity-85 hover:opacity-100",
                      theme.border,
                      theme.surfaceMuted,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-bold">{t.name}</span>
                      {selected && (
                        <span
                          className={cn("grid size-6 place-items-center rounded-full", t.accentBg)}
                        >
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </div>
                    <p className={cn("mt-1 flex-1 text-xs leading-relaxed", theme.mutedText)}>
                      {t.description}
                    </p>
                    <div className="mt-3 flex gap-1.5">
                      {t.swatches.map((hex) => (
                        <span
                          key={hex}
                          className="h-5 flex-1 rounded-md border border-black/10"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Section 4: Settings (Phone verification, Blocked Users, Password, Notifications, Logout) */}
        {section === "settings" && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Phone Verification */}
            {!me.phoneVerified && (
              <div
                className={cn(
                  "rounded-3xl border p-5 backdrop-blur-xl",
                  theme.surfaceGlass,
                  theme.border,
                  theme.cardShadow,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold">Verify Phone Number</h2>
                    <p className={cn("mt-0.5 text-xs", theme.mutedText)}>
                      {otpConfigured
                        ? "Confirm ownership of your phone number via SMS OTP."
                        : "SMS OTP requires Twilio Verify configuration on the server."}
                    </p>
                  </div>
                  {otpConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleSendPhoneVerifyOtp()}
                      className={cn("rounded-xl px-3.5 py-2 text-xs font-bold", theme.accentBg)}
                    >
                      Send OTP
                    </button>
                  )}
                </div>
                {verifyOtpSent && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={verifyOtpCode}
                      onChange={(e) => setVerifyOtpCode(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2 text-sm outline-none",
                        theme.border,
                        theme.surfaceMuted,
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => void handleConfirmPhoneOtp()}
                      className={cn("rounded-xl px-4 py-2 text-xs font-bold", theme.accentBg)}
                    >
                      Verify
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Blocked Users List */}
            <div
              className={cn(
                "rounded-3xl border p-5 backdrop-blur-xl",
                theme.surfaceGlass,
                theme.border,
                theme.cardShadow,
              )}
            >
              <div className="flex items-center gap-2">
                <Ban className="size-4 text-rose-600" />
                <h2 className="font-display text-base font-bold">Blocked Users</h2>
              </div>
              <p className={cn("mt-1 text-xs", theme.mutedText)}>
                Blocked users cannot send you messages or initiate calls. Enforced by the backend.
              </p>

              {blockedUsers.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {blockedUsers.map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5",
                        theme.border,
                        theme.surfaceMuted,
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{u.fullName}</p>
                        <p className={cn("truncate text-xs", theme.mutedText)}>{u.displayHandle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void unblockUser(u.id).then(() =>
                            toast.success(`Unblocked ${u.fullName}`),
                          )
                        }
                        className={cn(
                          "min-h-[38px] shrink-0 rounded-xl px-3.5 text-xs font-bold",
                          theme.accentBg,
                        )}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={cn("mt-3 text-xs", theme.mutedText)}>No blocked users.</p>
              )}
            </div>

            {/* Notification Sound */}
            <div
              className={cn(
                "rounded-3xl border p-5 backdrop-blur-xl",
                theme.surfaceGlass,
                theme.border,
                theme.cardShadow,
              )}
            >
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-2.5">
                  {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                  <span>
                    <span className="block text-sm font-bold">Message notification sound</span>
                    <span className={cn("block text-xs", theme.mutedText)}>
                      Play an alert chime when new messages arrive
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    soundEnabled ? theme.accentBg : theme.surfaceMuted,
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                      soundEnabled ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </div>

            {/* Change Password */}
            <form
              onSubmit={(e) => void handleChangePassword(e)}
              className={cn(
                "space-y-3 rounded-3xl border p-5 backdrop-blur-xl",
                theme.surfaceGlass,
                theme.border,
                theme.cardShadow,
              )}
            >
              <div className="flex items-center gap-2">
                <KeyRound className="size-4" />
                <h2 className="font-display text-base font-bold">Change Password</h2>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Current password"
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                    theme.border,
                    theme.surfaceMuted,
                  )}
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                    theme.border,
                    theme.surfaceMuted,
                  )}
                />
              </div>
              <button
                type="submit"
                disabled={pwdBusy}
                className={cn("min-h-[42px] rounded-xl px-4 text-xs font-bold", theme.accentBg)}
              >
                {pwdBusy ? "Updating…" : "Update Password"}
              </button>
            </form>

            {/* Account Navigation & Sign Out */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate({ to: "/home" })}
                className={cn(
                  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border text-xs font-bold",
                  theme.surface,
                  theme.border,
                )}
              >
                <BookOpen className="size-4" /> Back to Reading Corner
              </button>
              <button
                type="button"
                onClick={() =>
                  void logout().then(() => {
                    navigate({ to: "/auth", replace: true });
                  })
                }
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-rose-600 text-xs font-bold text-white"
              >
                <LogOut className="size-4" /> Log Out
              </button>
            </div>
          </motion.section>
        )}
      </div>

      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
