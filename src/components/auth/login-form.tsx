"use client";

import { useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const ACCOUNTS = [
  ["Student", "student@library.edu", "Student@123"],
  ["Librarian", "librarian@library.edu", "Librarian@123"],
  ["Admin", "admin@library.edu", "Admin@123"],
];

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("student@library.edu");
  const [password, setPassword] = useState("Student@123");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          const data = new FormData(event.currentTarget);
          const result = await loginAction(data);
          if (result?.error) setError(result.error);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Sign-in failed.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Label>
        Email
        <Input name="email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Label>
      <Label>
        Password
        <Input name="password" type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </Label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Signing in..." : "Sign in"}</Button>
      <div className="rounded-lg border border-[#e6e9f0] bg-white p-3 text-[12px] leading-5 text-[#667085]">
        <p className="font-medium text-[#151b2b]">Seeded development accounts</p>
        <p className="mt-1">These rows fill the form. They can sign in only after the database seed has run.</p>
        <div className="mt-2 space-y-1">
          {ACCOUNTS.map(([role, accountEmail, accountPassword]) => (
            <button
              key={accountEmail}
              type="button"
              className="block w-full rounded-md px-2 py-1 text-left hover:bg-[#f7f8fc]"
              onClick={() => {
                setEmail(accountEmail);
                setPassword(accountPassword);
                setError(null);
              }}
            >
              {role}: {accountEmail} / {accountPassword}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
