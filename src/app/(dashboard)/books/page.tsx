import { CatalogManager } from "@/components/books/catalog";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const session = await auth();
  if (!session?.user) return null;
  return <CatalogManager role={session.user.role} />;
}
