import { PolicyManager } from "@/components/policies/policy-manager";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const session = await auth();
  if (!session?.user) return null;
  return <PolicyManager role={session.user.role} />;
}
