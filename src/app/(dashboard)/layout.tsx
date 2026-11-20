import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <AppShell user={session.user}>{children}</AppShell>;
}
