import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { bookSchema } from "@/lib/validations";
import { deleteBook, getBook, recommendSimilarBooks, updateBook } from "@/services/bookService";

export const dynamic = "force-dynamic";

export const GET = api(async (request, context) => {
  await requirePermission("catalog.read");
  const { id } = await context.params;
  const similar = new URL(request.url).searchParams.get("similar");
  if (similar === "1") return ok(await recommendSimilarBooks(id));
  return ok(await getBook(id));
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("catalog.write");
  const { id } = await context.params;
  const body = parseBody(bookSchema.partial(), await readJson(request));
  return ok(await updateBook(id, body, user.id));
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("catalog.write");
  const { id } = await context.params;
  await deleteBook(id, user.id);
  return ok({ deleted: true });
});
