import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { fetchReadingState, saveReadingState, useChat } from "@/lib/chat-store";

export type ReaderPrefs = {
  theme: "light" | "sepia" | "dark";
  fontSize: number; // px
  font: "serif" | "sans";
  lineSpacing: "small" | "medium" | "large";
  width: "compact" | "normal" | "wide";
  speechRate: number;
  showProgressBar?: boolean;
  autoAdvanceSpeech?: boolean;
};

export type BookProgress = {
  page: number;
  pages: number;
  scrollRatio?: number;
  updatedAt: string;
};

export type AppState = {
  onboarded: boolean;
  languages: string[];
  categories: string[];
  appTheme: "light" | "dark" | "system";
  reader: ReaderPrefs;
  notifications: { reminders: boolean; newBooks: boolean };
  profile: { name: string; email: string };
  progress: Record<string, BookProgress>;
  favorites: string[];
  bookmarks: { bookId: string; page: number; at: string }[];
  completed: string[];
  history: { bookId: string; at: string }[];
  streak: number;
};

const DEFAULT_STATE: AppState = {
  onboarded: false,
  languages: [],
  categories: [],
  appTheme: "system",
  reader: {
    theme: "light",
    fontSize: 19,
    font: "serif",
    lineSpacing: "medium",
    width: "normal",
    speechRate: 1,
    showProgressBar: true,
    autoAdvanceSpeech: true,
  },
  notifications: { reminders: true, newBooks: true },
  profile: { name: "Reader", email: "reader@readingcorner.app" },
  progress: {},
  favorites: [],
  bookmarks: [],
  completed: [],
  history: [],
  streak: 1,
};

const KEY = "reading-corner.v1";
const userStorageKey = (userId: string) => `reading-corner.user.${userId}.v1`;

function mergeIncomingState(
  base: AppState,
  parsed: Partial<AppState> | null | undefined,
): AppState {
  if (!parsed) return base;
  return {
    ...base,
    ...parsed,
    reader: { ...base.reader, ...(parsed.reader ?? {}) },
    notifications: { ...base.notifications, ...(parsed.notifications ?? {}) },
    profile: { ...base.profile, ...(parsed.profile ?? {}) },
    progress: parsed.progress ?? base.progress,
    favorites: Array.isArray(parsed.favorites) ? parsed.favorites : base.favorites,
    bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : base.bookmarks,
    completed: Array.isArray(parsed.completed) ? parsed.completed : base.completed,
    history: Array.isArray(parsed.history) ? parsed.history : base.history,
    languages: Array.isArray(parsed.languages) ? parsed.languages : base.languages,
    categories: Array.isArray(parsed.categories) ? parsed.categories : base.categories,
  };
}

function readLocalState(key: string): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<AppState>) : null;
  } catch {
    return null;
  }
}

function hasAnyReadingData(s: Partial<AppState> | null | undefined): boolean {
  if (!s) return false;
  return Boolean(
    (s.progress && Object.keys(s.progress).length > 0) ||
    (s.favorites && s.favorites.length > 0) ||
    (s.bookmarks && s.bookmarks.length > 0) ||
    (s.history && s.history.length > 0) ||
    (s.completed && s.completed.length > 0),
  );
}

type Ctx = {
  state: AppState;
  ready: boolean;
  syncing: boolean;
  update: (patch: Partial<AppState>) => void;
  setReader: (patch: Partial<ReaderPrefs>) => void;
  toggleFavorite: (bookId: string) => void;
  toggleBookmark: (bookId: string, page: number) => void;
  isBookmarked: (bookId: string, page: number) => boolean;
  saveProgress: (bookId: string, page: number, pages: number, scrollRatio?: number) => void;
  markCompleted: (bookId: string) => void;
  reset: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { me, sessionToken, ready: chatReady } = useChat();
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const skipNextRemotePushRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);

  // Load local reading-corner.v1 immediately on mount so anonymous reading works with 0 delay
  useEffect(() => {
    const localAnon = readLocalState(KEY);
    if (localAnon) {
      setState((s) => mergeIncomingState(s, localAnon));
    }
    setReady(true);
  }, []);

  // Sync per-user reading state when signed in (keeping each user's data isolated & private)
  useEffect(() => {
    if (!chatReady || typeof window === "undefined") return;
    const activeUser = me;
    const uid = activeUser?.id ?? null;

    if (!activeUser || !uid || !sessionToken) {
      if (loadedUserIdRef.current !== null) {
        loadedUserIdRef.current = null;
        const anon = readLocalState(KEY);
        skipNextRemotePushRef.current = true;
        setState(mergeIncomingState(DEFAULT_STATE, anon));
      }
      return;
    }

    if (loadedUserIdRef.current === uid) {
      // Ensure profile display name matches active account without erasing reading state
      setState((s) =>
        s.profile.name === activeUser.fullName
          ? s
          : { ...s, profile: { ...s.profile, name: activeUser.fullName } },
      );
      return;
    }

    let cancelled = false;
    setSyncing(true);

    const perUserCached = readLocalState(userStorageKey(uid));
    if (perUserCached) {
      skipNextRemotePushRef.current = true;
      setState(
        mergeIncomingState(
          {
            ...DEFAULT_STATE,
            profile: {
              name: activeUser.fullName,
              email: activeUser.phoneMasked ?? "Account synced",
            },
          },
          perUserCached,
        ),
      );
    }

    fetchReadingState()
      .then((res) => {
        if (cancelled) return;
        loadedUserIdRef.current = uid;
        const remote = res.state as Partial<AppState> | null;
        if (remote) {
          const next = mergeIncomingState(
            {
              ...DEFAULT_STATE,
              profile: {
                name: activeUser.fullName,
                email: activeUser.phoneMasked ?? "Account synced",
              },
            },
            remote,
          );
          skipNextRemotePushRef.current = true;
          setState(next);
          try {
            localStorage.setItem(userStorageKey(uid), JSON.stringify(next));
          } catch {
            /* ignore */
          }
        } else {
          // Brand-new account with no server reading state yet:
          // Non-destructively carry over existing device reading progress if any exists
          const anon = readLocalState(KEY);
          const seed = hasAnyReadingData(perUserCached)
            ? perUserCached
            : hasAnyReadingData(anon)
              ? anon
              : null;
          const next = mergeIncomingState(
            {
              ...DEFAULT_STATE,
              profile: {
                name: activeUser.fullName,
                email: activeUser.phoneMasked ?? "Account synced",
              },
            },
            seed,
          );
          skipNextRemotePushRef.current = true;
          setState(next);
          if (seed) {
            void saveReadingState(next as unknown as Record<string, unknown>).catch(() => {});
          }
        }
      })
      .catch(() => {
        loadedUserIdRef.current = uid;
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chatReady, me, sessionToken]);

  // Persist to appropriate localStorage slot AND debounce sync to server for signed-in users
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const uid = me?.id ?? null;
    try {
      if (uid) {
        localStorage.setItem(userStorageKey(uid), JSON.stringify(state));
      } else {
        localStorage.setItem(KEY, JSON.stringify(state));
      }
    } catch {
      /* storage full or blocked */
    }

    if (uid && sessionToken && loadedUserIdRef.current === uid) {
      if (skipNextRemotePushRef.current) {
        skipNextRemotePushRef.current = false;
        return;
      }
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
      pushTimerRef.current = window.setTimeout(() => {
        void saveReadingState(state as unknown as Record<string, unknown>).catch(() => {});
      }, 450);
    }
  }, [state, ready, me?.id, sessionToken]);

  // App appearance & synced secret theme palette harmony across pages
  useEffect(() => {
    if (!ready || typeof document === "undefined") return;
    const root = document.documentElement;
    if (me?.theme) {
      root.dataset["secretTheme"] = me.theme;
    } else {
      delete root.dataset["secretTheme"];
    }

    const apply = () => {
      const dark =
        state.appTheme === "dark" ||
        (state.appTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [state.appTheme, ready, me?.theme]);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const setReader = useCallback((patch: Partial<ReaderPrefs>) => {
    setState((s) => ({ ...s, reader: { ...s.reader, ...patch } }));
  }, []);

  const toggleFavorite = useCallback((bookId: string) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(bookId)
        ? s.favorites.filter((f) => f !== bookId)
        : [bookId, ...s.favorites],
    }));
  }, []);

  const toggleBookmark = useCallback((bookId: string, page: number) => {
    setState((s) => {
      const exists = s.bookmarks.some((b) => b.bookId === bookId && b.page === page);
      return {
        ...s,
        bookmarks: exists
          ? s.bookmarks.filter((b) => !(b.bookId === bookId && b.page === page))
          : [{ bookId, page, at: new Date().toISOString() }, ...s.bookmarks],
      };
    });
  }, []);

  const isBookmarked = useCallback(
    (bookId: string, page: number) =>
      state.bookmarks.some((b) => b.bookId === bookId && b.page === page),
    [state.bookmarks],
  );

  const saveProgress = useCallback(
    (bookId: string, page: number, pages: number, scrollRatio?: number) => {
      setState((s) => {
        const at = new Date().toISOString();
        const history = [{ bookId, at }, ...s.history.filter((h) => h.bookId !== bookId)].slice(
          0,
          40,
        );
        const completed =
          page >= pages - 1 && !s.completed.includes(bookId)
            ? [bookId, ...s.completed]
            : s.completed;
        const prevRatio = s.progress[bookId]?.scrollRatio;
        return {
          ...s,
          progress: {
            ...s.progress,
            [bookId]: {
              page,
              pages,
              updatedAt: at,
              ...(scrollRatio !== undefined
                ? { scrollRatio }
                : prevRatio !== undefined
                  ? { scrollRatio: prevRatio }
                  : {}),
            },
          },
          history,
          completed,
        };
      });
    },
    [],
  );

  const markCompleted = useCallback((bookId: string) => {
    setState((s) => ({
      ...s,
      completed: s.completed.includes(bookId) ? s.completed : [bookId, ...s.completed],
    }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const value = useMemo(
    () => ({
      state,
      ready,
      syncing,
      update,
      setReader,
      toggleFavorite,
      toggleBookmark,
      isBookmarked,
      saveProgress,
      markCompleted,
      reset,
    }),
    [
      state,
      ready,
      syncing,
      update,
      setReader,
      toggleFavorite,
      toggleBookmark,
      isBookmarked,
      saveProgress,
      markCompleted,
      reset,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useLibrary must be used inside LibraryProvider");
  return ctx;
}

export function progressPercent(page: number, pages: number) {
  if (pages <= 1) return 100;
  return Math.min(100, Math.round(((page + 1) / pages) * 100));
}
