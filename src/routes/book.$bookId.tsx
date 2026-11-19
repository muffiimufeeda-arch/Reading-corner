import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  Heart,
  Plus,
  Share2,
  Star,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { EmptyState } from "@/components/EmptyState";
import { BookGrid, SectionHeader } from "@/components/Sections";
import { BOOKS, bookById, readingMinutes } from "@/lib/books";
import { useChat } from "@/lib/chat-store";
import { categoryBySlug, languageByCode } from "@/lib/catalog";
import { progressPercent, useLibrary } from "@/lib/library-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book/$bookId")({
  loader: ({ params }) => {
    const book = bookById(params.bookId);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Book not found — Reading Corner" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const b = loaderData.book;
    return {
      meta: [
        { title: `${b.title} by ${b.author} — Reading Corner` },
        { name: "description", content: b.description.slice(0, 155) },
        { property: "og:title", content: `${b.title} — ${b.author}` },
        { property: "og:description", content: b.description.slice(0, 155) },
        { property: "og:type", content: "book" },
      ],
    };
  },
  component: BookDetails,
  notFoundComponent: BookNotFound,
});

function BookNotFound() {
  return (
    <AppShell>
      <div className="px-4 py-16">
        <EmptyState
          title="Book not found"
          description="This title may have been moved. Explore the library instead."
          actionLabel="Explore Books"
        />
      </div>
    </AppShell>
  );
}

function sectionPreviewTitle(text: string, idx: number): string {
  const firstLine =
    text
      .split(/\n+/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  const firstSentence = firstLine.split(/[.!?]\s+/)[0]?.trim() ?? "";
  if (firstSentence.length >= 4 && firstSentence.length <= 56) return firstSentence;
  return `Section ${idx + 1}`;
}

function BookDetails() {
  const { book } = Route.useLoaderData();
  const { state, toggleFavorite, toggleBookmark } = useLibrary();
  const { me } = useChat();

  const cat = categoryBySlug(book.category);
  const lang = languageByCode(book.language);
  const fav = state.favorites.includes(book.id);
  const progress = state.progress[book.id];
  const bookmarked = state.bookmarks.some((b) => b.bookId === book.id);

  const similar = BOOKS.filter(
    (b) => b.id !== book.id && (b.category === book.category || b.language === book.language),
  ).slice(0, 5);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: book.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* share dismissed */
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/explore"
            aria-label="Back"
            className="press grid size-10 place-items-center rounded-full bg-secondary"
          >
            <ArrowLeft className="size-[18px]" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">Book Details</p>
          <button
            type="button"
            onClick={share}
            aria-label="Share book"
            className="press grid size-10 place-items-center rounded-full bg-secondary"
          >
            <Share2 className="size-[18px]" />
          </button>
        </div>

        <div className="grid gap-6 rounded-3xl bg-hero p-5 shadow-soft sm:grid-cols-[200px_1fr] sm:items-center sm:gap-8 sm:p-7">
          <motion.div
            whileHover={{ y: -4, rotateY: -4 }}
            transition={{ duration: 0.2 }}
            style={{ perspective: 900 }}
            className="mx-auto w-44 sm:mx-0 sm:w-full"
          >
            <BookCover book={book} size="lg" />
          </motion.div>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{book.title}</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{book.author}</p>

            {/* Clean Typographic Metadata */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1 font-bold text-foreground">
                <Star className="size-3.5 fill-gold text-gold" />
                {book.rating.toFixed(1)} ({book.reviews.toLocaleString()})
              </span>
              <span aria-hidden>·</span>
              <Link
                to="/language/$code"
                params={{ code: book.language }}
                className="font-semibold text-foreground hover:underline"
              >
                {lang?.name}
              </Link>
              <span aria-hidden>·</span>
              <Link
                to="/category/$slug"
                params={{ slug: book.category }}
                className="font-semibold text-foreground hover:underline"
              >
                {cat?.name}
              </Link>
              <span aria-hidden>·</span>
              <span>{book.pageCount} pages</span>
              <span aria-hidden>·</span>
              <span>~{readingMinutes(book)} min</span>
            </div>

            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              {me
                ? "Available immediately · Synced to your account"
                : "Available for full-screen swipe reading"}
            </p>

            {progress && (
              <div className="mt-4 rounded-2xl bg-card/85 p-3.5 shadow-soft backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                  <span>
                    Last read: Page {progress.page + 1} of {progress.pages}
                  </span>
                  <span>{progressPercent(progress.page, progress.pages)}% completed</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${progressPercent(progress.page, progress.pages)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/read/$bookId"
                search={{}}
                params={{ bookId: book.id }}
                className="press flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-center text-sm font-bold text-primary-foreground shadow-lift sm:flex-none sm:px-8"
              >
                <BookOpen className="size-4" />
                {progress ? "Continue Reading" : "Read Full-Screen"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  toggleFavorite(book.id);
                  toast.success(fav ? "Removed from library" : "Added to My Library");
                }}
                className="press flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-bold"
              >
                <Plus className="size-4" /> {fav ? "In Library" : "Add to Library"}
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => toggleFavorite(book.id)}
                aria-pressed={fav}
                className={cn(
                  "press flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-xs font-bold",
                  fav ? "bg-destructive/10 text-destructive" : "bg-card",
                )}
              >
                <Heart className={cn("size-4", fav && "fill-destructive")} />
                {fav ? "Favorited" : "Favorite"}
              </button>
              <button
                type="button"
                onClick={() => toggleBookmark(book.id, progress?.page ?? 0)}
                aria-pressed={bookmarked}
                className={cn(
                  "press flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-xs font-bold",
                  bookmarked ? "bg-sidebar-accent text-primary" : "bg-card",
                )}
              >
                {bookmarked ? (
                  <BookmarkCheck className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
                {bookmarked ? "Bookmarked" : "Bookmark"}
              </button>
              <button
                type="button"
                onClick={share}
                className="press flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-bold"
              >
                <Share2 className="size-4" /> Share
              </button>
            </div>
          </div>
        </div>

        <section>
          <SectionHeader title="About This Book" />
          <div className="rounded-3xl bg-card p-5 shadow-soft">
            <p className="text-sm leading-relaxed text-muted-foreground">{book.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Meta label="Publisher" value={book.publisher} />
              <Meta
                label="Published"
                value={book.year < 0 ? `${Math.abs(book.year)} BCE` : String(book.year)}
              />
              <Meta label="Pages" value={String(book.pageCount)} />
              <Meta label="Added" value={new Date(book.added).toLocaleDateString()} />
            </dl>
          </div>
        </section>

        {/* Chapter / Section Quick Jump */}
        <section>
          <SectionHeader title="Chapters & Reading Sections" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {book.content.map((sectionText, idx) => {
              const isCurrent = progress?.page === idx;
              return (
                <Link
                  key={idx}
                  to="/read/$bookId"
                  params={{ bookId: book.id }}
                  search={{ page: idx }}
                  className={cn(
                    "press flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-soft transition hover:border-primary/40",
                    isCurrent ? "border-primary" : "border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
                      isCurrent ? "bg-brand text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {sectionPreviewTitle(sectionText, idx)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {sectionText.slice(0, 68)}…
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {similar.length > 0 && (
          <section>
            <SectionHeader title="More Like This" />
            <BookGrid books={similar} />
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold">{value}</dd>
    </div>
  );
}
