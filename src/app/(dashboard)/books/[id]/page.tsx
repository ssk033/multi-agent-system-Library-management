import Link from "next/link";
import { notFound } from "next/navigation";
import { BorrowButton } from "@/components/books/borrow-button";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { getBook, recommendSimilarBooks } from "@/services/bookService";

export const dynamic = "force-dynamic";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  let book: Awaited<ReturnType<typeof getBook>>;
  let similar: Awaited<ReturnType<typeof recommendSimilarBooks>>;
  try {
    book = await getBook(id);
    similar = await recommendSimilarBooks(id);
  } catch {
    notFound();
  }
  return (
      <div>
        <Link href="/books" className="text-[13px] text-muted">Back to catalog</Link>
        <section className="panel mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{book.category}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{book.title}</h1>
              <p className="mt-2 text-muted">{book.author}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Badge tone={book.availableCopies > 0 ? "emerald" : "rose"}>{book.availableCopies} of {book.totalCopies} available</Badge>
              {session?.user.role === "STUDENT" && (
                <BorrowButton bookId={book.id} title={book.title} available={book.availableCopies > 0} />
              )}
            </div>
          </div>
          <dl className="mt-6 grid gap-4 text-[13px] sm:grid-cols-2">
            <div><dt className="text-muted">ISBN</dt><dd className="mt-1 font-mono">{book.isbn}</dd></div>
            <div><dt className="text-muted">Publisher</dt><dd className="mt-1">{book.publisher ?? "Not recorded"}</dd></div>
            <div><dt className="text-muted">Dewey decimal</dt><dd className="mt-1">{book.deweyDecimal ?? "Not recorded"}</dd></div>
          </dl>
          <p className="mt-6 max-w-3xl text-[14px] leading-7">{book.description}</p>
        </section>
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Related titles</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {similar.map((item) => (
              <Link key={item.id} href={`/books/${item.id}`} className="panel p-4">
                <p className="font-medium tracking-[-0.02em]">{item.title}</p>
                <p className="text-[13px] text-muted">{item.author}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
  );
}
