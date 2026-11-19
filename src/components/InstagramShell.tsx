import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Phone, PhoneOff, User, Video } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { InstagramChatView } from "@/components/InstagramChatView";
import { InstagramProfileView, type ProfileSection } from "@/components/InstagramProfileView";
import { Logo } from "@/components/Logo";
import { TripleTapExit } from "@/components/TripleTapExit";
import { initialsOf, respondToCall, useChat } from "@/lib/chat-store";
import { getSecretTheme } from "@/lib/secret-themes";
import { cn } from "@/lib/utils";

export function InstagramShell({
  initialTab = "chat",
  initialProfileSection = "gallery",
}: {
  initialTab?: "chat" | "profile";
  initialProfileSection?: ProfileSection;
}) {
  const navigate = useNavigate();
  const { ready, me, conversations, incomingCall, outgoingCall } = useChat();
  const [tab, setTab] = useState<"chat" | "profile">(initialTab);
  const [threadOpenOnMobile, setThreadOpenOnMobile] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (ready && !me) {
      navigate({ to: "/auth", replace: true });
    }
  }, [ready, me, navigate]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  if (!ready || !me) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#090b12] text-white">
        <div className="text-center">
          <Logo className="mx-auto size-10 animate-pulse" />
          <p className="mt-3 text-xs font-medium text-white/70">Opening Reading Corner…</p>
        </div>
      </div>
    );
  }

  const theme = getSecretTheme(me.theme);

  return (
    <div
      className={cn("relative flex h-[100dvh] flex-col overflow-hidden md:flex-row", theme.pageBg)}
    >
      {/* Ambient studio backdrop matching user design */}
      <div className={cn("pointer-events-none fixed inset-0", theme.ambientBackdrop)} />
      <TripleTapExit />

      {/* Desktop Left Navigation Rail (Instagram-inspired: strictly Chat & Profile) */}
      <aside
        className={cn(
          "relative z-10 hidden w-20 shrink-0 flex-col justify-between border-r py-5 backdrop-blur-xl md:flex lg:w-60 lg:px-4",
          theme.border,
          theme.surfaceGlass,
        )}
      >
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setTab("chat")}
            className="flex w-full items-center justify-center gap-3 px-2 text-left lg:justify-start"
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-2xl p-1.5",
                theme.accentBg,
              )}
            >
              <Logo className="size-6" />
            </span>
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate font-display text-base font-extrabold">
                Reading Corner
              </span>
              <span className={cn("block truncate text-[11px] font-medium", theme.mutedText)}>
                Read · Chat · Grow
              </span>
            </span>
          </button>

          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={cn(
                "flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl px-3 text-sm font-bold transition lg:justify-start",
                tab === "chat" ? theme.navActiveBg : theme.mutedText,
              )}
            >
              <span className="relative">
                <MessageCircle className="size-5" />
                {totalUnread > 0 && (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1.5 grid size-4 place-items-center rounded-full text-[9px] font-bold",
                      theme.badgeBg,
                    )}
                  >
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline">Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("profile")}
              className={cn(
                "flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl px-3 text-sm font-bold transition lg:justify-start",
                tab === "profile" ? theme.navActiveBg : theme.mutedText,
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full p-[1.5px]",
                  theme.ringGradient,
                )}
              >
                <span
                  className={cn(
                    "grid size-full place-items-center overflow-hidden rounded-full text-[10px] font-bold",
                    theme.surface,
                  )}
                >
                  {me.avatarUrl ? (
                    <img src={me.avatarUrl} alt={me.fullName} className="size-full object-cover" />
                  ) : (
                    initialsOf(me.fullName)
                  )}
                </span>
              </span>
              <span className="hidden lg:inline">Profile</span>
            </button>
          </nav>
        </div>

        <p className={cn("hidden px-2 text-[11px] leading-relaxed lg:block", theme.mutedText)}>
          Reading progress, gallery &amp; NFC card are inside Profile.
        </p>
      </aside>

      {/* Main Content Area with Smooth Transitions */}
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === "chat" ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <InstagramChatView
                theme={theme}
                onOpenProfile={() => setTab("profile")}
                onThreadOpenChange={setThreadOpenOnMobile}
              />
            </motion.div>
          ) : (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16 }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <InstagramProfileView
                theme={theme}
                initialSection={initialProfileSection}
                onBackToChat={() => setTab("chat")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Glass Mobile Bottom Navigation (Strictly Chat & Profile) */}
      {!(tab === "chat" && threadOpenOnMobile) && (
        <nav
          className={cn(
            "fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 rounded-[26px] border p-1.5 backdrop-blur-xl md:hidden",
            theme.navBg,
          )}
        >
          <div className="mx-auto grid max-w-md grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={cn(
                "flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] px-4 text-xs font-bold transition",
                tab === "chat" ? theme.navActiveBg : theme.mutedText,
              )}
            >
              <span className="relative">
                <MessageCircle className="size-5" />
                {totalUnread > 0 && (
                  <span
                    className={cn(
                      "absolute -right-2.5 -top-1.5 grid size-4 place-items-center rounded-full text-[9px] font-bold",
                      theme.badgeBg,
                    )}
                  >
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </span>
              <span>Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("profile")}
              className={cn(
                "flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] px-4 text-xs font-bold transition",
                tab === "profile" ? theme.navActiveBg : theme.mutedText,
              )}
            >
              <User className="size-5" />
              <span>Profile</span>
            </button>
          </div>
        </nav>
      )}

      {/* Real-time Incoming / Outgoing Call Modal */}
      <AnimatePresence>
        {(incomingCall || outgoingCall) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className={cn(
                "w-full max-w-xs rounded-3xl border p-6 text-center shadow-2xl",
                theme.surfaceGlass,
                theme.border,
              )}
            >
              {incomingCall ? (
                <>
                  <div
                    className={cn(
                      "mx-auto grid size-16 place-items-center rounded-full text-xl font-bold",
                      theme.accentBg,
                    )}
                  >
                    {incomingCall.callType === "video" ? (
                      <Video className="size-7" />
                    ) : (
                      <Phone className="size-7" />
                    )}
                  </div>
                  <p className="mt-4 font-display text-lg font-extrabold">
                    {incomingCall.from.fullName}
                  </p>
                  <p className={cn("mt-1 text-xs", theme.mutedText)}>
                    Incoming {incomingCall.callType} call…
                  </p>
                  <div className="mt-6 flex justify-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        respondToCall(incomingCall.callId, incomingCall.from.id, "declined")
                      }
                      className="grid size-14 place-items-center rounded-full bg-rose-600 text-white"
                      aria-label="Decline call"
                    >
                      <PhoneOff className="size-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        respondToCall(incomingCall.callId, incomingCall.from.id, "accepted")
                      }
                      className="grid size-14 place-items-center rounded-full bg-emerald-600 text-white"
                      aria-label="Accept call"
                    >
                      <Phone className="size-6" />
                    </button>
                  </div>
                </>
              ) : outgoingCall ? (
                <>
                  <div
                    className={cn(
                      "mx-auto grid size-16 place-items-center rounded-full text-xl font-bold",
                      theme.accentBg,
                    )}
                  >
                    {outgoingCall.callType === "video" ? (
                      <Video className="size-7" />
                    ) : (
                      <Phone className="size-7" />
                    )}
                  </div>
                  <p className="mt-4 font-display text-lg font-extrabold">
                    {outgoingCall.target.fullName}
                  </p>
                  <p className={cn("mt-1 text-xs", theme.mutedText)}>
                    {outgoingCall.status === "accepted" ? "Connected" : "Ringing…"}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      respondToCall(outgoingCall.callId, outgoingCall.target.id, "ended")
                    }
                    className="mx-auto mt-6 grid size-14 place-items-center rounded-full bg-rose-600 text-white"
                    aria-label="End call"
                  >
                    <PhoneOff className="size-6" />
                  </button>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
