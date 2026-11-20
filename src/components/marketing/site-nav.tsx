"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const LINKS = [
  { href: "#architecture", label: "Architecture" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#workflow", label: "Workflow" },
  { href: "#platform", label: "Platform" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <Link href="/" aria-label="Autonomous Library home" onClick={() => setOpen(false)}>
          <BrandLockup />
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Page">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-[13px] text-muted transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/login"
            onClick={(event) => {
              event.preventDefault();
              window.location.assign("/login");
            }}
            className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Sign in
          </a>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md border border-border md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border px-5 py-3 md:hidden" aria-label="Mobile">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2.5 text-sm text-foreground"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
