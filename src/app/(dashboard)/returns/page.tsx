import { LoansManager } from "@/components/loans/loans-manager";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const session = await auth();
  if (!session?.user) return null;
  return <LoansManager role={session.user.role} mode="returns" />;
}
