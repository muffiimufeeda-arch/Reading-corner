import {
  ArrowLeft,
  Ban,
  BookOpen,
  Check,
  CheckCheck,
  Download,
  Film,
  ImagePlus,
  MessageCircle,
  Mic,
  MoreVertical,
  PenLine,
  Phone,
  Search,
  Send,
  ShieldAlert,
  Smile,
  Sparkles,
  Square,
  Users,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import {
  blockUser,
  formatRelative,
  formatTime,
  initialsOf,
  initiateCall,
  openThread,
  searchUsers,
  sendChatMessage,
  sendTyping,
  unblockUser,
  uploadChatMedia,
  useChat,
  type ChatMessage,
  type MediaKind,
  type PublicAccount,
} from "@/lib/chat-store";
import type { SecretThemeTokens } from "@/lib/secret-themes";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😍",
  "🤔",
  "👍",
  "🙌",
  "🔥",
  "✨",
  "📚",
  "☕",
  "🌙",
  "❤️",
  "🎉",
  "😭",
  "👀",
];

function UserAvatar({
  user,
  theme,
  size = "md",
}: {
  user: PublicAccount;
  theme: SecretThemeTokens;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-12" : size === "sm" ? "size-9" : "size-11";
  return (
    <span className="relative inline-flex shrink-0">
      <span className={cn("rounded-full p-[2px]", theme.ringGradient)}>
        <span
          className={cn(
            "grid place-items-center overflow-hidden rounded-full font-display font-bold",
            theme.surface,
            dim,
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            initialsOf(user.fullName)
          )}
        </span>
      </span>
      {user.online && (
        <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]" />
      )}
    </span>
  );
}

export function MediaLightbox({
  media,
  onClose,
}: {
  media: { url: string; kind: "image" | "video"; name: string } | null;
  onClose: () => void;
}) {
  if (!media) return null;
  const downloadHref = `${media.url}${media.url.includes("?") ? "&" : "?"}download=1`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="truncate text-sm font-semibold">{media.name}</p>
          <div className="flex items-center gap-2">
            <a
              href={downloadHref}
              download={media.name}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/25"
            >
              <Download className="size-4" /> Download
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="grid size-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
          {media.kind === "image" ? (
            <img
              src={media.url}
              alt={media.name}
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          ) : (
            <video
              src={media.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-2xl"
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function InstagramChatView({
  theme,
  onOpenProfile,
  onThreadOpenChange,
}: {
  theme: SecretThemeTokens;
  onOpenProfile?: () => void;
  onThreadOpenChange?: (open: boolean) => void;
}) {
  const { me, conversations, activePeerId, threads, typingByPeer } = useChat();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicAccount[]>([]);
  const [searching, setSearching] = useState(false);

  const [draft, setDraft] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{
    id: string;
    url: string;
    kind: MediaKind;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lightbox, setLightbox] = useState<{
    url: string;
    kind: "image" | "video";
    name: string;
  } | null>(null);

  // Mobile keyboard viewport tracking so input is NEVER covered by soft keyboard
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    onThreadOpenChange?.(Boolean(activePeerId));
  }, [activePeerId, onThreadOpenChange]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const syncViewport = () => {
      setViewportHeight(vv.height);
      endRef.current?.scrollIntoView({ block: "end" });
    };
    syncViewport();
    vv.addEventListener("resize", syncViewport);
    vv.addEventListener("scroll", syncViewport);
    return () => {
      vv.removeEventListener("resize", syncViewport);
      vv.removeEventListener("scroll", syncViewport);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      searchUsers(trimmed)
        .then((users) => {
          if (!cancelled) setSearchResults(users);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const activeConv = useMemo(
    () => conversations.find((c) => c.peer.id === activePeerId) ?? null,
    [conversations, activePeerId],
  );
  const activePeer = activeConv?.peer ?? null;
  const activeMessages: ChatMessage[] = useMemo(
    () => (activePeerId ? (threads[activePeerId] ?? []) : []),
    [activePeerId, threads],
  );

  const lastSeenOutgoingId = useMemo(() => {
    if (!me) return null;
    for (let i = activeMessages.length - 1; i >= 0; i -= 1) {
      const m = activeMessages[i];
      if (m && m.from === me.id && m.seenAt) return m.id;
    }
    return null;
  }, [activeMessages, me]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeMessages.length, activePeerId]);

  function handleDraftChange(val: string) {
    setDraft(val);
    if (!activePeerId || activeConv?.blockedByMe || activeConv?.blockedMe) return;
    sendTyping(activePeerId, true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      sendTyping(activePeerId, false);
    }, 1500);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activePeerId) return;
    setUploading(true);
    try {
      const uploaded = await uploadChatMedia(file, activePeerId);
      setPendingMedia({
        id: uploaded.id,
        url: uploaded.url,
        kind: uploaded.kind,
        name: uploaded.originalName || file.name,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload media.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!activePeerId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => chunks.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setUploading(true);
        try {
          const uploaded = await uploadChatMedia(file, activePeerId);
          setPendingMedia({
            id: uploaded.id,
            url: uploaded.url,
            kind: "audio",
            name: uploaded.originalName,
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Voice upload failed.");
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission required to record a voice note.");
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activePeerId || sending) return;
    const text = draft.trim();
    if (!text && !pendingMedia) return;

    setSending(true);
    try {
      await sendChatMessage(activePeerId, text, pendingMedia?.id ?? null);
      setDraft("");
      setPendingMedia(null);
      setEmojiOpen(false);
      sendTyping(activePeerId, false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function handleBlockToggle() {
    if (!activePeer) return;
    setMenuOpen(false);
    try {
      if (activeConv?.blockedByMe) {
        await unblockUser(activePeer.id);
        toast.success(`Unblocked ${activePeer.fullName}`);
      } else {
        await blockUser(activePeer.id);
        toast.success(`Blocked ${activePeer.fullName}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function handleStartCall(callType: "audio" | "video") {
    if (!activePeer) return;
    try {
      await initiateCall(activePeer, callType);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot initiate call.");
    }
  }

  if (!me) return null;

  const isBlocked = Boolean(activeConv?.blockedByMe || activeConv?.blockedMe);

  return (
    <div
      style={activePeerId && viewportHeight ? { height: `${viewportHeight}px` } : undefined}
      className={cn(
        "flex w-full flex-1 overflow-hidden",
        activePeerId ? "h-[100dvh] md:h-full" : "h-full",
      )}
    >
      {/* Left Conversation List (Specular Glass Recent Chats Container) */}
      <aside
        className={cn(
          "relative flex w-full flex-col md:w-80 md:border-r lg:w-96",
          theme.border,
          activePeer && "hidden md:flex",
        )}
      >
        {/* Top Frosted Studio Header (Zero public member counters) */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5 md:pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "glass-sheen grid size-10 shrink-0 place-items-center rounded-full p-1.5 md:hidden",
                theme.accentBg,
              )}
            >
              <Logo className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-extrabold">{me.fullName}</p>
              <p className={cn("truncate text-[11px] font-medium", theme.mutedText)}>
                Read · Chat · Grow
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              aria-label="Search chats"
              className={cn(
                "grid size-10 place-items-center rounded-full border transition",
                theme.glassPill,
              )}
            >
              <Search className="size-4" />
            </motion.button>
            {onOpenProfile && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={onOpenProfile}
                aria-label="Open profile"
                className={cn("rounded-full p-[2px] md:hidden", theme.ringGradient)}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center overflow-hidden rounded-full text-xs font-bold",
                    theme.surface,
                  )}
                >
                  {me.avatarUrl ? (
                    <img src={me.avatarUrl} alt={me.fullName} className="size-full object-cover" />
                  ) : (
                    initialsOf(me.fullName)
                  )}
                </span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Elevated Translucent Glass Recent Chats Sheet */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative mx-2.5 mb-20 mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] border md:mx-3 md:mb-3",
            theme.glassSheet,
          )}
        >
          {/* Inner Frosted Search Pill */}
          <div className="p-3.5 pb-2.5">
            <div className="relative">
              <Search
                className={cn(
                  "pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2",
                  theme.accentText,
                )}
              />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats by phone or name..."
                className={cn(
                  "w-full rounded-full border py-2.5 pl-11 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-current/15",
                  theme.glassRow,
                )}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-16">
            {query.trim() ? (
              <div className="space-y-2">
                <p className={cn("px-2 py-1 text-xs font-bold", theme.mutedText)}>
                  {searching ? "Searching…" : "Search results"}
                </p>
                {searchResults.map((u, idx) => (
                  <motion.button
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      void openThread(u.id);
                    }}
                    className={cn(
                      "flex min-h-[62px] w-full items-center gap-3 rounded-full border px-3 py-2 text-left transition",
                      theme.glassRow,
                    )}
                  >
                    <UserAvatar user={u} theme={theme} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{u.fullName}</span>
                      <span className={cn("block truncate text-xs", theme.mutedText)}>
                        {u.displayHandle}
                      </span>
                    </span>
                  </motion.button>
                ))}
                {!searching && searchResults.length === 0 && (
                  <p className={cn("px-4 py-8 text-center text-xs", theme.mutedText)}>
                    No matching reader found. Ask them for their phone number or name.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span
                    className={cn("inline-flex items-center gap-1.5 text-xs font-bold", theme.text)}
                  >
                    <Users className={cn("size-3.5", theme.accentText)} /> Recent Chats
                  </span>
                </div>
                {conversations.map((c, idx) => {
                  const selected = c.peer.id === activePeerId;
                  const isTyping = typingByPeer[c.peer.id];
                  return (
                    <motion.button
                      key={c.peer.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: Math.min(idx * 0.04, 0.24),
                        duration: 0.24,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => void openThread(c.peer.id)}
                      className={cn(
                        "flex min-h-[66px] w-full items-center gap-3 rounded-[26px] border px-3 py-2.5 text-left transition",
                        selected ? theme.glassRowSelected : theme.glassRow,
                      )}
                    >
                      <UserAvatar user={c.peer} theme={theme} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold">{c.peer.fullName}</span>
                          {c.lastMessage && (
                            <span
                              className={cn("shrink-0 text-[11px] tabular-nums", theme.mutedText)}
                            >
                              {formatRelative(c.lastMessage.createdAt)}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "truncate text-xs",
                              c.unreadCount > 0 ? "font-bold" : theme.mutedText,
                            )}
                          >
                            {c.blockedByMe
                              ? "Blocked"
                              : isTyping
                                ? "Typing…"
                                : c.lastMessage
                                  ? `${c.lastMessage.from === me.id ? "You: " : ""}${c.lastMessage.text}`
                                  : c.peer.displayHandle}
                          </span>
                          {c.unreadCount > 0 && (
                            <span
                              className={cn(
                                "ml-auto grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums shadow-sm",
                                theme.badgeBg,
                              )}
                            >
                              {c.unreadCount}
                            </span>
                          )}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}

                {conversations.length === 0 && (
                  <div className="px-5 py-12 text-center">
                    <MessageCircle className={cn("mx-auto size-10 opacity-40", theme.mutedText)} />
                    <p className="mt-3 text-sm font-bold">No conversations yet</p>
                    <p className={cn("mt-1 text-xs leading-relaxed", theme.mutedText)}>
                      Search by phone number or name above to start a real-time chat.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Floating Specular Glass Compose Pencil FAB */}
          <motion.button
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            aria-label="Start new chat"
            className={cn(
              "glass-sheen absolute bottom-3.5 right-3.5 grid size-12 place-items-center rounded-full border border-white/40",
              theme.accentBg,
            )}
          >
            <PenLine className="size-5" />
          </motion.button>
        </motion.div>
      </aside>

      {/* Right Active Thread Panel (Curved Glass Sheet + Floating Pill Header & Composer) */}
      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden",
          !activePeer && "hidden md:flex",
        )}
      >
        {activePeer ? (
          <>
            {/* Floating Frosted Glass Header Pill */}
            <motion.header
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.22 }}
              className={cn(
                "relative z-20 mx-2.5 mt-2.5 flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-2 md:mx-4 md:mt-3",
                theme.glassPill,
              )}
            >
              <button
                type="button"
                onClick={() => void openThread(null)}
                aria-label="Back to chats"
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full md:hidden",
                  theme.surfaceMuted,
                )}
              >
                <ArrowLeft className="size-5" />
              </button>
              <UserAvatar user={activePeer} theme={theme} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{activePeer.fullName}</p>
                <p
                  className={cn("flex items-center gap-1.5 truncate text-[11px]", theme.mutedText)}
                >
                  {activePeer.online && (
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  )}
                  <span>
                    {typingByPeer[activePeer.id]
                      ? "Typing…"
                      : activePeer.online
                        ? "Online"
                        : `Active ${formatRelative(activePeer.lastActiveAt)} ago`}
                  </span>
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                disabled={isBlocked}
                onClick={() => void handleStartCall("video")}
                aria-label="Video call"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full transition hover:opacity-85 disabled:opacity-40",
                  theme.surfaceMuted,
                )}
              >
                <Video className="size-4" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                disabled={isBlocked}
                onClick={() => void handleStartCall("audio")}
                aria-label="Audio call"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full transition hover:opacity-85 disabled:opacity-40",
                  theme.surfaceMuted,
                )}
              >
                <Phone className="size-4" />
              </motion.button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Conversation options"
                  className={cn("grid size-9 place-items-center rounded-full", theme.surfaceMuted)}
                >
                  <MoreVertical className="size-4" />
                </button>
                {menuOpen && (
                  <div
                    className={cn(
                      "absolute right-0 top-11 z-30 w-48 rounded-2xl border p-1.5 shadow-xl",
                      theme.surfaceGlass,
                      theme.border,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void handleBlockToggle()}
                      className="flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-bold text-rose-500 transition hover:bg-rose-500/10"
                    >
                      <Ban className="size-4" />
                      {activeConv?.blockedByMe ? "Unblock user" : "Block user"}
                    </button>
                  </div>
                )}
              </div>
            </motion.header>

            {/* Atmospheric Study Band Behind Rising Curved Glass Conversation Sheet */}
            <div className="relative flex min-h-0 flex-1 flex-col pt-3 md:px-4 md:pt-4">
              {/* Subtle animated light band behind sheet edge */}
              <div className="pointer-events-none mx-6 mb-1 flex items-center justify-center gap-2 text-[11px] font-semibold opacity-65">
                <BookOpen className="size-3.5" />
                <span>Private encrypted media &amp; real-time chat</span>
                <Sparkles className="size-3.5" />
              </div>

              {/* Curved Specular Frosted Glass Messages Sheet */}
              <div
                className={cn(
                  "relative flex min-h-0 flex-1 flex-col rounded-t-[32px] border-x border-t md:rounded-[32px] md:border",
                  theme.glassSheet,
                )}
              >
                {/* Floating Notched "Today" Glass Pill */}
                {activeMessages.length > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 -top-3.5 z-10 flex justify-center">
                    <span
                      className={cn(
                        "rounded-full border px-4 py-1 text-[11px] font-bold tracking-wide",
                        theme.glassPill,
                      )}
                    >
                      Today
                    </span>
                  </div>
                )}

                <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-4 pt-6 sm:px-5">
                  {activeMessages.map((m) => {
                    const mine = m.from === me.id;
                    const isLastSeen = mine && m.id === lastSeenOutgoingId;
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-1"
                      >
                        <div
                          className={cn(
                            "flex items-end gap-2",
                            mine ? "justify-end" : "justify-start",
                          )}
                        >
                          {!mine && <UserAvatar user={activePeer} theme={theme} size="sm" />}
                          <div
                            className={cn(
                              "max-w-[80%] rounded-[22px] px-3.5 py-2.5 text-sm sm:max-w-[66%]",
                              mine ? "rounded-br-md" : "rounded-bl-md",
                              mine ? theme.myBubble : theme.peerBubble,
                            )}
                          >
                            {m.mediaUrl && m.mediaKind === "image" && (
                              <div className="group relative mb-2 overflow-hidden rounded-2xl">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightbox({
                                      url: m.mediaUrl!,
                                      kind: "image",
                                      name: m.mediaName || "photo.jpg",
                                    })
                                  }
                                  className="block w-full"
                                >
                                  <img
                                    src={m.mediaUrl}
                                    alt={m.mediaName || "Shared photo"}
                                    className="max-h-64 w-full rounded-2xl object-cover"
                                  />
                                </button>
                                <a
                                  href={`${m.mediaUrl}?download=1`}
                                  download={m.mediaName || "photo.jpg"}
                                  aria-label="Download photo"
                                  className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-black/65 text-white backdrop-blur-sm transition hover:bg-black/85"
                                >
                                  <Download className="size-4" />
                                </a>
                              </div>
                            )}

                            {m.mediaUrl && m.mediaKind === "video" && (
                              <div className="relative mb-2 overflow-hidden rounded-2xl bg-black">
                                <video
                                  src={m.mediaUrl}
                                  controls
                                  playsInline
                                  className="max-h-64 w-full rounded-2xl object-cover"
                                />
                                <div className="flex items-center justify-between bg-black/75 px-3 py-1.5 text-[11px] text-white">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightbox({
                                        url: m.mediaUrl!,
                                        kind: "video",
                                        name: m.mediaName || "video.mp4",
                                      })
                                    }
                                    className="inline-flex items-center gap-1 font-semibold"
                                  >
                                    <Film className="size-3.5" /> Fullscreen
                                  </button>
                                  <a
                                    href={`${m.mediaUrl}?download=1`}
                                    download={m.mediaName || "video.mp4"}
                                    className="inline-flex items-center gap-1 font-semibold"
                                  >
                                    <Download className="size-3.5" /> Download
                                  </a>
                                </div>
                              </div>
                            )}

                            {m.mediaUrl && m.mediaKind === "audio" && (
                              <div className="mb-2 space-y-1.5">
                                <audio src={m.mediaUrl} controls className="w-52 max-w-full" />
                                <a
                                  href={`${m.mediaUrl}?download=1`}
                                  download={m.mediaName || "voice.webm"}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold underline opacity-90"
                                >
                                  <Download className="size-3" /> Save audio
                                </a>
                              </div>
                            )}

                            {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80 tabular-nums">
                              <span>{formatTime(m.createdAt)}</span>
                              {mine &&
                                (m.seenAt ? (
                                  <CheckCheck className="size-3.5" />
                                ) : (
                                  <Check className="size-3.5" />
                                ))}
                            </div>
                          </div>
                        </div>
                        {isLastSeen && (
                          <p
                            className={cn(
                              "pr-1 text-right text-[10px] font-semibold",
                              theme.mutedText,
                            )}
                          >
                            Seen
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                  <div ref={endRef} />
                </div>

                {/* Blocked Banner or Keyboard-Safe Frosted Pill Composer */}
                {isBlocked ? (
                  <div
                    className={cn(
                      "mx-2.5 mb-2.5 shrink-0 rounded-3xl border px-4 py-3.5 text-center",
                      theme.glassPill,
                    )}
                  >
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-rose-500">
                      <ShieldAlert className="size-4" />
                      <span>
                        {activeConv?.blockedByMe
                          ? `You blocked ${activePeer.fullName}. Unblock to message or call.`
                          : "You cannot message or call this user."}
                      </span>
                    </div>
                    {activeConv?.blockedByMe && (
                      <button
                        type="button"
                        onClick={() => void handleBlockToggle()}
                        className={cn(
                          "mt-2.5 rounded-full px-4 py-2 text-xs font-bold",
                          theme.accentBg,
                        )}
                      >
                        Unblock {activePeer.fullName}
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "mx-2.5 mb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0 overflow-hidden rounded-[28px] border md:mx-3 md:mb-3",
                      theme.glassPill,
                    )}
                  >
                    {emojiOpen && (
                      <div
                        className={cn("grid grid-cols-8 gap-1 border-b px-3 py-2", theme.border)}
                      >
                        {EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setDraft((d) => d + em)}
                            className="rounded-xl py-1.5 text-lg transition hover:scale-110"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}

                    {pendingMedia && (
                      <div
                        className={cn("flex items-center gap-3 border-b px-3.5 py-2", theme.border)}
                      >
                        {pendingMedia.kind === "image" ? (
                          <img
                            src={pendingMedia.url}
                            alt="Ready to send"
                            className="size-12 rounded-xl object-cover"
                          />
                        ) : pendingMedia.kind === "video" ? (
                          <video
                            src={pendingMedia.url}
                            className="size-12 rounded-xl object-cover"
                          />
                        ) : (
                          <span
                            className={cn(
                              "grid size-12 place-items-center rounded-xl",
                              theme.surfaceMuted,
                            )}
                          >
                            <Mic className="size-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{pendingMedia.name}</p>
                          <p className={cn("text-[11px]", theme.mutedText)}>Ready to send</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingMedia(null)}
                          aria-label="Remove attachment"
                          className="grid size-8 place-items-center rounded-full"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleSend} className="flex items-end gap-1.5 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => setEmojiOpen((s) => !s)}
                        aria-label="Emoji"
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full transition hover:scale-105",
                          theme.surfaceMuted,
                        )}
                      >
                        <Smile className="size-5" />
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        aria-label="Attach photo or video"
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full transition hover:scale-105 disabled:opacity-50",
                          theme.surfaceMuted,
                        )}
                      >
                        <ImagePlus className="size-5" />
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => void toggleRecording()}
                        aria-label={recording ? "Stop recording" : "Voice note"}
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full transition hover:scale-105",
                          recording ? "bg-rose-600 text-white" : theme.surfaceMuted,
                        )}
                      >
                        {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => void handleFileSelect(e)}
                        className="hidden"
                      />

                      <textarea
                        value={draft}
                        onChange={(e) => handleDraftChange(e.target.value)}
                        onFocus={() => {
                          window.setTimeout(() => {
                            endRef.current?.scrollIntoView({ block: "end" });
                          }, 150);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSend(e);
                          }
                        }}
                        rows={1}
                        placeholder={uploading ? "Uploading media…" : `Type a message…`}
                        className={cn(
                          "max-h-28 min-h-[42px] flex-1 resize-none rounded-full border px-4 py-2.5 text-sm outline-none",
                          theme.border,
                          theme.surfaceMuted,
                        )}
                      />
                      <motion.button
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        type="submit"
                        disabled={sending || uploading || (!draft.trim() && !pendingMedia)}
                        aria-label="Send message"
                        className={cn(
                          "glass-sheen grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-45",
                          theme.accentBg,
                        )}
                      >
                        <Send className="size-4" />
                      </motion.button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center p-10 text-center md:flex">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className={cn(
                "glass-sheen grid size-16 place-items-center rounded-full",
                theme.accentBg,
              )}
            >
              <MessageCircle className="size-7" />
            </motion.div>
            <p className="mt-4 font-display text-xl font-bold">Your Messages</p>
            <p className={cn("mt-1.5 max-w-xs text-sm", theme.mutedText)}>
              Select a conversation or search by phone number to chat in real time with photos and
              videos.
            </p>
          </div>
        )}
      </section>

      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
