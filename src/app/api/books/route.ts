import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { bookSchema } from "@/lib/validations";
import { listCategories, searchBooksSemantic, searchCatalog, createBook } from "@/services/bookService";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  await requirePermission("catalog.read");
  const url = new URL(request.url);
  if (url.searchParams.get("categories") === "1") return ok(await listCategories());
  const mode = url.searchParams.get("mode");
  const query = url.searchParams.get("q") ?? undefined;
  if (mode === "semantic") {
    if (!query) return ok([]);
    return ok(await searchBooksSemantic(query));
  }
  return ok(
    await searchCatalog({
      query,
      author: url.searchParams.get("author") ?? undefined,
      isbn: url.searchParams.get("isbn") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      availability: (url.searchParams.get("availability") as "all" | "available" | "unavailable" | null) ?? "all",
    }),
  );
});

export const POST = api(async (request) => {
  const user = await requirePermission("catalog.write");
  const body = parseBody(bookSchema, await readJson(request));
  return ok(await createBook(body, user.id), 201);
});
