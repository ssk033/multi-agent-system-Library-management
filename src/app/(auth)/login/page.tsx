import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLockup } from "@/components/brand/logo";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user && params.reason !== "expired") redirect("/overview");
  return (
    <main className="grid min-h-screen bg-[#f7f8fc] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between bg-[#101426] p-12 text-white lg:flex">
          <BrandLockup inverse />
        <div>
          <h1 className="max-w-sm text-4xl font-semibold tracking-[-0.04em]">Sign in to the library desk.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#98a2b3]">Students search and borrow. Librarians review acquisitions. Administrators configure policy and inspect agent traces.</p>
        </div>
        <p className="text-[12px] text-[#667085]">Passwords are hashed. API keys stay on the server.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <BrandLockup className="mb-8 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Welcome back</h2>
          <p className="mb-6 mt-2 text-[13px] text-[#667085]">
            {params.reason === "expired"
              ? "That sign-in no longer matches the library database. Sign in again with your seeded account."
              : "Use a seeded account after the database has been loaded."}
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
