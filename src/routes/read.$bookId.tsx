import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ListOrdered,
  Minus,
  Pause,
  Play,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { bookById, readingMinutes, type Book } from "@/lib/books";
import { categoryBySlug, languageByCode } from "@/lib/catalog";
import { progressPercent, useLibrary } from "@/lib/library-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/read/$bookId")({
  validateSearch: (search: Record<string, unknown>): { page?: number | undefined } => ({
    page: search["page"] === undefined ? undefined : Number(search["page"]),
  }),
  head: () => ({
    meta: [
      { title: "Reader — Reading Corner" },
      {
        name: "description",
        content:
          "Full-screen swipe e-reader with gesture page turns, bookmarks, chapter navigation, read-aloud and automatic progress sync.",
      },
      { property: "og:title", content: "Reader — Reading Corner" },
      { property: "og:description", content: "Read full-screen with natural swipe page turns." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReaderPage,
});

const LANG_BCP47: Record<string, string> = {
  en: "en-US",
  ml: "ml-IN",
  kn: "kn-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  ar: "ar-SA",
  other: "en-US",
};

function buildQuizQuestions(book: Book) {
  const cat = categoryBySlug(book.category)?.name ?? book.category;
  const lang = languageByCode(book.language)?.name ?? "World";
  const yearDisplay = book.year < 0 ? `${Math.abs(book.year)} BCE` : String(book.year);
  const wrongAuthors = [
    "Leo Tolstoy",
    "Virginia Woolf",
    "Gabriel García Márquez",
    "Hermann Hesse",
  ].filter((a) => a !== book.author);
  const wrongCats = ["Mystery", "Science", "History", "Literature"].filter((c) => c !== cat);

  return [
    {
      prompt: `Who wrote "${book.title}"?`,
      options: [book.author, wrongAuthors[0]!, wrongAuthors[1]!].sort(),
      answer: book.author,
    },
    {
      prompt: `Which category does this book belong to in Reading Corner?`,
      options: [cat, wrongCats[0]!, wrongCats[1]!].sort(),
      answer: cat,
    },
    {
      prompt: `What edition year and language match this work?`,
      options: [
        `${yearDisplay} · ${lang}`,
        `${book.year < 0 ? "1920" : Number(book.year) + 42} · French`,
        `2004 · Latin`,
      ],
      answer: `${yearDisplay} · ${lang}`,
    },
  ];
}

function pageHeadingOf(text: string, idx: number): string {
  const firstLine =
    text
      .split(/\n+/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  const sentence = firstLine.split(/[.!?]\s+/)[0]?.trim() ?? "";
  if (sentence.length >= 4 && sentence.length <= 54) return sentence;
  return `Section ${idx + 1}`;
}

function ReaderPage() {
  const { bookId } = Route.useParams();
  const book = bookById(bookId);
  const { page: pageParam } = Route.useSearch();
  const navigate = useNavigate();
  const { state, ready, syncing, setReader, saveProgress, toggleBookmark, isBookmarked } =
    useLibrary();

  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [panel, setPanel] = useState<"none" | "settings" | "chapters" | "quiz">("none");
  const [speaking, setSpeaking] = useState(false);
  const [restored, setRestored] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});

  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    t: number;
    selecting: boolean;
    lockedAxis: "h" | "v" | null;
  } | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const wheelLockRef = useRef<number>(0);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const pendingScrollRatioRef = useRef<number | null>(null);
  const speakingRef = useRef(false);

  const pages = useMemo(() => book?.content ?? [], [book]);
  const total = pages.length;

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  // Restore saved page + exact scroll position when opening/reopening a book
  useEffect(() => {
    if (!ready || syncing || restored || !book) return;
    if (pageParam !== undefined && Number.isFinite(pageParam)) {
      setPage(Math.min(Math.max(0, Math.floor(pageParam)), Math.max(0, total - 1)));
      setRestored(true);
      return;
    }
    const saved = state.progress[book.id];
    if (saved && saved.page < total) {
      setPage(saved.page);
      if (typeof saved.scrollRatio === "number" && saved.scrollRatio > 0) {
        pendingScrollRatioRef.current = saved.scrollRatio;
      }
    }
    setRestored(true);
  }, [ready, syncing, restored, book, state.progress, total, pageParam]);

  // Apply restored vertical scroll ratio after page renders
  useEffect(() => {
    if (!restored || pendingScrollRatioRef.current === null) return;
    const ratio = pendingScrollRatioRef.current;
    pendingScrollRatioRef.current = null;
    window.requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) el.scrollTop = Math.round(max * ratio);
    });
  }, [restored, page]);

  const prevPageSaveRef = useRef<number | null>(null);

  // Automatically save last-read page on every page transition
  useEffect(() => {
    if (!restored || !book || total === 0) return;
    const isInitialRestore = prevPageSaveRef.current === null;
    const changed = !isInitialRestore && prevPageSaveRef.current !== page;
    prevPageSaveRef.current = page;
    saveProgress(book.id, page, total, changed ? 0 : undefined);
  }, [page, restored, book, total, saveProgress]);

  // Cancel TTS on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const go = useCallback(
    (dir: -1 | 1, opts?: { keepSpeech?: boolean }) => {
      if (!opts?.keepSpeech) stopSpeech();
      setPage((p) => {
        const next = Math.min(total - 1, Math.max(0, p + dir));
        if (next === p) {
          if (dir === 1 && p === total - 1) {
            setControlsVisible(true);
            toast.success("You reached the final page");
          }
          return p;
        }
        setDirection(dir);
        return next;
      });
      if (scrollerRef.current) {
        scrollerRef.current.scrollTop = 0;
      }
    },
    [stopSpeech, total],
  );

  const jumpToPage = useCallback(
    (targetIdx: number) => {
      stopSpeech();
      const clamped = Math.min(total - 1, Math.max(0, targetIdx));
      setDirection(clamped >= page ? 1 : -1);
      setPage(clamped);
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    },
    [page, stopSpeech, total],
  );

  // Desktop keyboard navigation (ArrowLeft / ArrowRight / Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        if (panel !== "none") setPanel("none");
        else setControlsVisible(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, panel]);

  const prefs = state.reader;

  const speakPage = useCallback(
    (pageIndex: number) => {
      if (!book || typeof window === "undefined" || !("speechSynthesis" in window)) {
        toast.error("Text-to-speech is unavailable in this browser.");
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(pages[pageIndex] ?? "");
      utter.rate = prefs.speechRate;
      utter.lang = LANG_BCP47[book.language] ?? "en-US";
      utter.onend = () => {
        if (!speakingRef.current) return;
        if (prefs.autoAdvanceSpeech !== false && pageIndex < total - 1) {
          const nextIdx = pageIndex + 1;
          setDirection(1);
          setPage(nextIdx);
          if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
          window.setTimeout(() => {
            if (speakingRef.current) speakPage(nextIdx);
          }, 260);
        } else {
          setSpeaking(false);
        }
      };
      utter.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    [book, pages, prefs.autoAdvanceSpeech, prefs.speechRate, total],
  );

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeech();
    } else {
      speakPage(page);
    }
  };

  const quiz = useMemo(() => (book ? buildQuizQuestions(book) : []), [book]);

  if (!book) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <EmptyState
          title="Book not found"
          description="This book isn't in the library. Try exploring our collection instead."
          actionLabel="Explore books"
          actionTo="/explore"
        />
      </div>
    );
  }

  const percent = progressPercent(page, total);
  const bookmarked = isBookmarked(book.id, page);
  const showProgressBar = prefs.showProgressBar !== false;

  const hasSelectedText = () => {
    if (typeof window === "undefined") return false;
    const sel = window.getSelection();
    return Boolean(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
  };

  // Touch Swipe + Long-Press Text Selection Protection
  const handleTouchStart = (e: React.TouchEvent) => {
    if (panel !== "none") return;
    const touch = e.touches[0];
    if (!touch) return;
    if (hasSelectedText()) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
      selecting: false,
      lockedAxis: null,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start || panel !== "none") return;
    const touch = e.touches[0];
    if (!touch) return;

    if (hasSelectedText()) {
      start.selecting = true;
      setDragOffsetX(0);
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.t;

    // Long press without moving => user is selecting text to copy
    if (!start.lockedAxis && elapsed > 320 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      start.selecting = true;
      setDragOffsetX(0);
      return;
    }
    if (start.selecting) return;

    if (!start.lockedAxis && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      if (Math.abs(dx) > Math.abs(dy) * 1.35) {
        start.lockedAxis = "h";
      } else {
        start.lockedAxis = "v";
      }
    }

    if (start.lockedAxis === "h") {
      // Gentle rubber-band resistance at first / last page boundaries
      const atBoundary = (page === 0 && dx > 0) || (page === total - 1 && dx < 0);
      setDragOffsetX(atBoundary ? dx * 0.25 : Math.max(-180, Math.min(180, dx)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setDragOffsetX(0);
    if (!start || start.selecting || panel !== "none") return;
    if (hasSelectedText()) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const dt = Date.now() - start.t;

    if (start.lockedAxis === "h" || (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4)) {
      if (dx <= -48) {
        go(1);
      } else if (dx >= 48) {
        go(-1);
      }
      return;
    }

    // Crisp single tap toggles reading controls
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input")) return;
      setControlsVisible((v) => !v);
    }
  };

  // Desktop Mouse Selection Safety + Center Tap to Toggle Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (panel !== "none") return;
    const start = mouseDownPosRef.current;
    mouseDownPosRef.current = null;
    if (!start) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input")) return;

    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    // If user dragged mouse or highlighted text, never turn page or toggle controls
    if (moved > 6 || hasSelectedText()) return;

    setControlsVisible((v) => !v);
  };

  // Trackpad two-finger horizontal swipe
  const handleWheel = (e: React.WheelEvent) => {
    if (panel !== "none") return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.35 && Math.abs(e.deltaX) > 28) {
      const now = Date.now();
      if (now - wheelLockRef.current < 420) return;
      wheelLockRef.current = now;
      if (e.deltaX > 0) go(1);
      else go(-1);
    }
  };

  // Throttled vertical scroll progress saving inside long pages
  const handleInnerScroll = () => {
    const el = scrollerRef.current;
    if (!el || !book) return;
    const max = el.scrollHeight - el.clientHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    if (scrollSaveTimerRef.current) window.clearTimeout(scrollSaveTimerRef.current);
    scrollSaveTimerRef.current = window.setTimeout(() => {
      saveProgress(book.id, page, total, ratio);
    }, 350);
  };

  return (
    <div
      className={cn(
        "relative flex h-[100dvh] w-full flex-col overflow-hidden",
        prefs.theme === "light"
          ? "reader-light"
          : prefs.theme === "sepia"
            ? "reader-sepia"
            : "reader-dark",
      )}
      style={{ background: "var(--reader-bg)", color: "var(--reader-fg)", perspective: 1200 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Top Floating Reading Controls (hidden by default; tap screen to toggle) */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.header
            initial={{ y: -72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -72, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-0 z-30 border-b border-current/10 backdrop-blur-xl"
            style={{ background: "color-mix(in oklab, var(--reader-bg) 90%, transparent)" }}
          >
            <div className="mx-auto grid max-w-4xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:px-5">
              <Link
                to="/book/$bookId"
                params={{ bookId: book.id }}
                aria-label="Back to book"
                className="press grid size-10 place-items-center rounded-full bg-current/10"
              >
                <ArrowLeft className="size-[18px]" />
              </Link>
              <div className="min-w-0 text-center">
                <p className="truncate text-sm font-semibold">{book.title}</p>
                <p className="truncate text-[11px] opacity-70 tabular-nums">
                  Page {page + 1} of {total} · {percent}%
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanel("chapters")}
                  aria-label="Chapters and sections"
                  className="press grid size-10 place-items-center rounded-full bg-current/10"
                >
                  <ListOrdered className="size-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleBookmark(book.id, page)}
                  aria-label="Bookmark this page"
                  className="press grid size-10 place-items-center rounded-full bg-current/10"
                >
                  <Bookmark className={cn("size-[18px]", bookmarked && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={toggleSpeech}
                  aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
                  className={cn(
                    "press grid size-10 place-items-center rounded-full",
                    speaking ? "bg-brand text-primary-foreground" : "bg-current/10",
                  )}
                >
                  {speaking ? <Pause className="size-[18px]" /> : <Play className="size-[18px]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPanel("quiz")}
                  aria-label="Reading check quiz"
                  className="press grid size-10 place-items-center rounded-full bg-current/10"
                >
                  <GraduationCap className="size-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setPanel("settings")}
                  aria-label="Reader settings"
                  className="press grid size-10 place-items-center rounded-full bg-current/10"
                >
                  <Settings2 className="size-[18px]" />
                </button>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Full-Screen Page Canvas with Animated Horizontal Page Turn */}
      <div
        ref={scrollerRef}
        onScroll={handleInnerScroll}
        className="no-scrollbar flex-1 overflow-y-auto px-5 py-10 sm:px-8 sm:py-14"
        style={{ touchAction: "pan-y" }}
      >
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            initial={{ opacity: 0.25, x: direction * 64, rotateY: direction * 4 }}
            animate={{ opacity: 1, x: dragOffsetX, rotateY: dragOffsetX * -0.025 }}
            exit={{ opacity: 0, x: direction * -64, rotateY: direction * -4 }}
            transition={
              dragOffsetX !== 0 ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
            }
            className={cn(
              "mx-auto min-h-[calc(100dvh-7rem)]",
              prefs.width === "compact"
                ? "max-w-xl"
                : prefs.width === "wide"
                  ? "max-w-4xl"
                  : "max-w-2xl",
            )}
          >
            {/* Subtle top book marker on first page */}
            {page === 0 && (
              <div className="mb-6 border-b border-current/10 pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-55">
                  {book.author}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">
                  {book.title}
                </h1>
              </div>
            )}

            <article
              className={cn("select-text", prefs.font === "serif" ? "font-display" : "font-sans")}
              style={{
                fontSize: `${prefs.fontSize}px`,
                lineHeight:
                  prefs.lineSpacing === "small" ? 1.5 : prefs.lineSpacing === "large" ? 2.1 : 1.8,
              }}
            >
              <p className="whitespace-pre-line">{pages[page]}</p>
            </article>

            {/* End-of-book completion reflection card inside the last page (not a page-turn button!) */}
            {page === total - 1 && (
              <div className="mt-12 rounded-3xl border border-current/15 bg-current/[0.04] p-5 text-center">
                <BookOpen className="mx-auto size-6 opacity-75" />
                <p className="mt-2 font-display text-lg font-bold">Finished "{book.title}"</p>
                <p className="mt-1 text-xs opacity-70">
                  Saved to your completed shelf · ~{readingMinutes(book)} min read
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel("quiz")}
                    className="press rounded-full bg-brand px-4 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Quick Comprehension Check
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/library" })}
                    className="press rounded-full bg-current/10 px-4 py-2 text-xs font-bold"
                  >
                    Open My Library
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Optional Minimal Reading Progress Indicator (no buttons, zero visual clutter) */}
      {showProgressBar && !controlsVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-2 pt-1">
          <div className="mx-auto flex max-w-2xl items-center gap-3 text-[10px] font-semibold opacity-45 tabular-nums">
            <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-current/20">
              <div
                className="h-full rounded-full bg-current transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span>
              {page + 1}/{total}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Tap-Revealed Scrubber Bar (no Previous/Next buttons) */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.footer
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-current/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
            style={{ background: "color-mix(in oklab, var(--reader-bg) 90%, transparent)" }}
          >
            <div className="mx-auto max-w-2xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold opacity-75 tabular-nums">
                <span className="truncate">{pageHeadingOf(pages[page] ?? "", page)}</span>
                <span>
                  Page {page + 1} / {total} ({percent}%)
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, total - 1)}
                value={page}
                onChange={(e) => jumpToPage(Number(e.target.value))}
                aria-label="Jump to page"
                className="h-2 w-full cursor-pointer accent-current"
              />
              <p className="text-center text-[10px] opacity-55">
                Swipe left or right to turn pages · Tap anywhere to hide controls
              </p>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>

      {/* Reader Settings Modal Sheet */}
      {panel === "settings" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
          <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 text-foreground shadow-lift sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Reading Settings</h2>
              <button
                type="button"
                onClick={() => setPanel("none")}
                aria-label="Close settings"
                className="press grid size-9 place-items-center rounded-full bg-secondary"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm">
              <Field label="Reader surface">
                <Segmented
                  options={[
                    { value: "light", label: "Light" },
                    { value: "sepia", label: "Sepia" },
                    { value: "dark", label: "Night" },
                  ]}
                  value={prefs.theme}
                  onChange={(v) => setReader({ theme: v as typeof prefs.theme })}
                />
              </Field>

              <Field label="Typography">
                <Segmented
                  options={[
                    { value: "serif", label: "Serif" },
                    { value: "sans", label: "Sans" },
                  ]}
                  value={prefs.font}
                  onChange={(v) => setReader({ font: v as typeof prefs.font })}
                />
              </Field>

              <Field label={`Font size — ${prefs.fontSize}px`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReader({ fontSize: Math.max(14, prefs.fontSize - 1) })}
                    aria-label="Decrease font size"
                    className="press grid size-9 place-items-center rounded-full bg-secondary"
                  >
                    <Minus className="size-4" />
                  </button>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${((prefs.fontSize - 14) / 14) * 100}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setReader({ fontSize: Math.min(28, prefs.fontSize + 1) })}
                    aria-label="Increase font size"
                    className="press grid size-9 place-items-center rounded-full bg-secondary"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </Field>

              <Field label="Line spacing">
                <Segmented
                  options={[
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                    { value: "large", label: "Large" },
                  ]}
                  value={prefs.lineSpacing}
                  onChange={(v) => setReader({ lineSpacing: v as typeof prefs.lineSpacing })}
                />
              </Field>

              <Field label="Page width">
                <Segmented
                  options={[
                    { value: "compact", label: "Compact" },
                    { value: "normal", label: "Normal" },
                    { value: "wide", label: "Wide" },
                  ]}
                  value={prefs.width}
                  onChange={(v) => setReader({ width: v as typeof prefs.width })}
                />
              </Field>

              <Field label={`Read-aloud speed — ${prefs.speechRate.toFixed(1)}x`}>
                <Segmented
                  options={[
                    { value: "0.8", label: "0.8x" },
                    { value: "1", label: "1x" },
                    { value: "1.3", label: "1.3x" },
                  ]}
                  value={String(prefs.speechRate)}
                  onChange={(v) => setReader({ speechRate: Number(v) })}
                />
              </Field>

              <SwitchRow
                label="Show progress indicator while reading"
                checked={showProgressBar}
                onChange={(v) => setReader({ showProgressBar: v })}
              />
              <SwitchRow
                label="Auto-read next page during Read-Aloud"
                checked={prefs.autoAdvanceSpeech !== false}
                onChange={(v) => setReader({ autoAdvanceSpeech: v })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chapter / Page Jump Drawer */}
      {panel === "chapters" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
          <div className="max-h-[82dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 text-foreground shadow-lift sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Chapters & Pages</h2>
                <p className="text-xs text-muted-foreground">{book.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPanel("none")}
                aria-label="Close chapters"
                className="press grid size-9 place-items-center rounded-full bg-secondary"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {pages.map((content, idx) => {
                const active = idx === page;
                const marked = isBookmarked(book.id, idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      jumpToPage(idx);
                      setPanel("none");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                      active ? "border-primary bg-primary/10" : "border-border bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
                        active ? "bg-brand text-primary-foreground" : "bg-secondary",
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {pageHeadingOf(content, idx)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {content.slice(0, 72)}…
                      </span>
                    </span>
                    {marked && <Bookmark className="size-4 shrink-0 fill-primary text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Comprehension & Learning Check Modal */}
      {panel === "quiz" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 text-foreground shadow-lift sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Quick Reading Check</h2>
                <p className="text-xs text-muted-foreground">{book.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPanel("none")}
                aria-label="Close quiz"
                className="press grid size-9 place-items-center rounded-full bg-secondary"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {quiz.map((q, qi) => {
                const picked = quizAnswers[qi];
                const isCorrect = picked === q.answer;
                return (
                  <div key={q.prompt} className="rounded-2xl border border-border bg-card p-3.5">
                    <p className="text-sm font-semibold">{q.prompt}</p>
                    <div className="mt-2.5 space-y-1.5">
                      {q.options.map((opt) => {
                        const selected = picked === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: opt }))}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition",
                              selected
                                ? isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-rose-600 text-white"
                                : "bg-secondary text-secondary-foreground",
                            )}
                          >
                            <span>{opt}</span>
                            {selected && isCorrect && <CheckCircle2 className="size-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "press flex-1 rounded-full px-3 py-2 text-xs font-bold transition-colors",
            value === o.value
              ? "bg-brand text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex min-h-[42px] w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-xs font-semibold">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
