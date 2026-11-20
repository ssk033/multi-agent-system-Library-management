"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronLeft,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  PackagePlus,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
  Undo2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const NAV: Array<{ href: string; label: string; icon: LucideIcon; roles: UserRole[] }> = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, roles: ["STUDENT", "LIBRARIAN", "ADMIN"] },
  { href: "/assistant", label: "AI Library Assistant", icon: Sparkles, roles: ["STUDENT", "LIBRARIAN", "ADMIN"] },
  { href: "/books", label: "Book Catalogue", icon: Library, roles: ["STUDENT", "LIBRARIAN", "ADMIN"] },
  { href: "/students", label: "Students", icon: Users, roles: ["LIBRARIAN", "ADMIN"] },
  { href: "/loans", label: "Active Loans", icon: BookOpen, roles: ["STUDENT", "LIBRARIAN", "ADMIN"] },
  { href: "/returns", label: "Returns", icon: Undo2, roles: ["LIBRARIAN", "ADMIN"] },
  { href: "/acquisitions", label: "Acquisitions", icon: PackagePlus, roles: ["LIBRARIAN", "ADMIN"] },
  { href: "/agents", label: "Agent activity", icon: Bot, roles: ["ADMIN"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["LIBRARIAN", "ADMIN"] },
  { href: "/policies", label: "Library Policies", icon: ScrollText, roles: ["STUDENT", "LIBRARIAN", "ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

export function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: UserRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const items = NAV.filter((item) => item.roles.includes(user.role));
  const current = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  const sidebar = (forceExpanded = false) => {
    const narrow = collapsed && !forceExpanded;
    return (
      <aside className={cn("flex h-full flex-col bg-sidebar text-[#d0d5dd] transition-[width] duration-200", narrow ? "w-[72px]" : "w-[248px]")}>
        <div className={cn("flex items-center gap-3 px-4 py-5", narrow && "justify-center px-2")}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-white">AL</div>
          {!narrow && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">Autonomous Library</p>
              <p className="truncate text-[11px] text-[#98a2b3]">Supervisor desk</p>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setOpen(false)}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-[#c8cdd8] transition hover:bg-white/6 hover:text-white",
                  narrow && "justify-center px-0",
                  active && "bg-white/8 text-white",
                )}
              >
                {active && <span className="absolute left-0 h-4 w-0.5 rounded-full bg-primary" />}
                <Icon className="h-4 w-4 shrink-0" />
                {!narrow && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/8 p-3">
          <div className={cn("flex items-center gap-2", narrow && "justify-center")}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/8 text-[11px] font-medium text-white">
              {(user.name ?? "U").slice(0, 1)}
            </div>
            {!narrow && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[#98a2b3]">{user.role}</p>
              </div>
            )}
          </div>
          <form action={logoutAction} className="mt-2">
            <button
              className={cn("flex h-8 w-full items-center justify-center gap-2 rounded-md text-[12px] text-[#c8cdd8] hover:bg-white/6 hover:text-white", narrow && "px-0")}
              type="submit"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              {!narrow && "Sign out"}
            </button>
          </form>
        </div>
      </aside>
    );
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="relative hidden lg:block">
        {sidebar(false)}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-6 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted shadow-sm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition", collapsed && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-[#101626]/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[248px]">{sidebar(true)}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button className="grid h-8 w-8 place-items-center rounded-md border border-border lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <p className="text-[13px] text-muted">{current?.label ?? "Library"}</p>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted" onClick={toggleTheme} aria-label="Toggle color theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
