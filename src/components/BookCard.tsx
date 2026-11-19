import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { motion } from "motion/react";

import { BookCover } from "@/components/BookCover";
import type { Book } from "@/lib/books";
import { categoryBySlug, languageByCode } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function BookCard({
  book,
  className,
  showMeta = true,
}: {
  book: Book;
  className?: string;
  showMeta?: boolean;
}) {
  const cat = categoryBySlug(book.category);
  const lang = languageByCode(book.language);
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={cn("group", className)}
    >
      <Link
        to="/book/$bookId"
        params={{ bookId: book.id }}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="overflow-hidden rounded-xl shadow-soft transition-shadow duration-200 group-hover:shadow-lift">
          <BookCover book={book} />
        </div>
        <div className="mt-2.5 space-y-1">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
            {book.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
          {showMeta && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="size-3 fill-gold text-gold" />
                {book.rating.toFixed(1)}
              </span>
              {lang && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{lang.name}</span>
                </>
              )}
              {cat && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{cat.name}</span>
                </>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function BookRow({
  book,
  percent,
  trailing,
}: {
  book: Book;
  percent?: number;
  trailing?: React.ReactNode;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.14 }}>
      <Link
        to="/book/$bookId"
        params={{ bookId: book.id }}
        className="flex items-center gap-3.5 rounded-2xl bg-card p-3 shadow-soft transition-shadow hover:shadow-lift"
      >
        <div className="w-14 shrink-0">
          <BookCover book={book} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
          {typeof percent === "number" ? (
            <div className="mt-2 flex items-center gap-2 tabular-nums">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">{percent}%</span>
            </div>
          ) : (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums">
              <Star className="size-3 fill-gold text-gold" />
              {book.rating.toFixed(1)}
            </p>
          )}
        </div>
        {trailing}
      </Link>
    </motion.div>
  );
}
