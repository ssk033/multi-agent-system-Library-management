"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BorrowButton } from "@/components/books/borrow-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { BookDTO, UserRole } from "@/types";

const EMPTY = { isbn: "", title: "", author: "", publisher: "", publicationYear: "", category: "", description: "", deweyDecimal: "", totalCopies: "1" };

function availabilityLabel(book: Pick<BookDTO, "availableCopies" | "totalCopies">) {
  if (book.availableCopies <= 0) return "Unavailable";
  if (book.availableCopies < book.totalCopies) return "Limited copies";
  return "Available";
}

function availabilityTone(book: Pick<BookDTO, "availableCopies" | "totalCopies">): "emerald" | "amber" | "rose" {
  if (book.availableCopies <= 0) return "rose";
  if (book.availableCopies < book.totalCopies) return "amber";
  return "emerald";
}

export function CatalogManager({ role }: { role: UserRole }) {
  const canWrite = role !== "STUDENT";
  const [books, setBooks] = useState<BookDTO[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BookDTO | null>(null);

  async function load(mode?: "semantic") {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (author) params.set("author", author);
    if (isbn) params.set("isbn", isbn);
    if (category) params.set("category", category);
    if (availability !== "all") params.set("availability", availability);
    if (mode === "semantic") params.set("mode", "semantic");
    const response = await fetch(`/api/books?${params.toString()}`);
    const body = await response.json();
    if (!body.ok) {
      setError(body.error);
      return;
    }
    setError(null);
    setBooks(body.data);
  }

  useEffect(() => {
    void fetch("/api/books").then(async (response) => {
      const body = await response.json();
      if (!body.ok) setError(body.error);
      else {
        setError(null);
        setBooks(body.data);
      }
    });
    void fetch("/api/books?categories=1").then(async (response) => {
      const body = await response.json();
      if (body.ok) setCategories(body.data);
    });
  }, []);

  async function removeBook() {
    if (!pendingDelete) return;
    const response = await fetch(`/api/books/${pendingDelete.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else {
      setError(null);
      setPendingDelete(null);
      await load();
    }
  }

  async function save() {
    const payload = {
      ...form,
      publisher: form.publisher || null,
      publicationYear: form.publicationYear ? Number(form.publicationYear) : null,
      description: form.description || null,
      deweyDecimal: form.deweyDecimal || null,
      totalCopies: Number(form.totalCopies),
    };
    const response = await fetch(editing ? `/api/books/${editing}` : "/api/books", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!body.ok) {
      setError(body.error);
      return;
    }
    setOpen(false);
    setEditing(null);
    setForm(EMPTY);
    await load();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Collection</p>
          <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">Book Catalogue</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {canWrite
              ? "Keyword filters query the live catalog. Semantic search needs embeddings."
              : "Search the catalog, then borrow an available title. You confirm the loan before a copy is reserved."}
          </p>
        </div>
        {canWrite && <Button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }}>Add book</Button>}
      </div>
      <div className="panel mb-3 grid gap-3 p-3 md:grid-cols-5">
        <Input placeholder="Title or description" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Input placeholder="Author" value={author} onChange={(event) => setAuthor(event.target.value)} />
        <Input placeholder="ISBN" value={isbn} onChange={(event) => setIsbn(event.target.value)} />
        <Select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </Select>
        <Select value={availability} onChange={(event) => setAvailability(event.target.value)}>
          <option value="all">Any availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </Select>
        <div className="flex gap-2 md:col-span-5">
          <Button type="button" onClick={() => void load()}>Search</Button>
          <Button type="button" variant="secondary" className="border-primary/30 text-primary" onClick={() => void load("semantic")}>Semantic search</Button>
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="panel overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr>
              <th>Book</th>
              <th>Author</th>
              <th>ISBN</th>
              <th>Category</th>
              <th>Availability</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id} className="border-b border-border last:border-0">
                <td>
                  <Link href={`/books/${book.id}`} className="font-medium tracking-[-0.02em] hover:underline">{book.title}</Link>
                </td>
                <td className="text-muted">{book.author}</td>
                <td className="font-mono text-[12px] text-muted">{book.isbn}</td>
                <td>{book.category}</td>
                <td><Badge tone={availabilityTone(book)}>{availabilityLabel(book)}</Badge></td>
                <td className="text-right">
                  {!canWrite && (
                    <BorrowButton bookId={book.id} title={book.title} available={book.availableCopies > 0} onBorrowed={() => void load()} />
                  )}
                  {canWrite && (
                    <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => {
                      setEditing(book.id);
                      setForm({
                        isbn: book.isbn,
                        title: book.title,
                        author: book.author,
                        publisher: book.publisher ?? "",
                        publicationYear: book.publicationYear ? String(book.publicationYear) : "",
                        category: book.category,
                        description: book.description ?? "",
                        deweyDecimal: book.deweyDecimal ?? "",
                        totalCopies: String(book.totalCopies),
                      });
                      setOpen(true);
                    }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => setPendingDelete(book)}>Delete</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} title={editing ? "Edit book" : "Add book"} onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Label>Title<Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Label>
          <Label>Author<Input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></Label>
          <Label>ISBN<Input value={form.isbn} onChange={(event) => setForm({ ...form, isbn: event.target.value })} /></Label>
          <Label>Category<Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Label>
          <Label>Copies<Input value={form.totalCopies} onChange={(event) => setForm({ ...form, totalCopies: event.target.value })} /></Label>
          <Label>Description<Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Label>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </Dialog>
      <Dialog open={Boolean(pendingDelete)} title="Delete book" onClose={() => setPendingDelete(null)}>
        <p className="text-sm text-muted">Delete {pendingDelete?.title}? Books with loan history stay in the catalog.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => void removeBook()}>Delete book</Button>
        </div>
      </Dialog>
    </div>
  );
}
