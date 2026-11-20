import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/overview");
  return (
    <main className="grid min-h-screen bg-[#f7f8fc] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden flex-col justify-between bg-[#101626] p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[#5145cd] text-[11px] font-semibold">AL</div>
          <p className="text-sm font-medium">Autonomous Library</p>
        </div>
        <div>
          <h1 className="max-w-sm text-4xl font-semibold tracking-[-0.04em]">Sign in to the library desk.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#98a2b3]">Students search and borrow. Librarians review acquisitions. Administrators configure policy and inspect agent traces.</p>
        </div>
        <p className="text-[12px] text-[#667085]">Passwords are hashed. API keys stay on the server.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Welcome back</h2>
          <p className="mb-6 mt-2 text-[13px] text-[#667085]">Use a seeded account after the database has been loaded.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
