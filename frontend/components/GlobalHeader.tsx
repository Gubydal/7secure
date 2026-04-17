"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Newsletter" },
  { href: "/articles", label: "Articles" },
  { href: "/tools", label: "Tools" },
  { href: "/practices", label: "Practices" }
];

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export function GlobalHeader() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#09090b]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" onClick={() => setIsMobileOpen(false)}>
          <Image src="/7secure_logo.svg" alt="7secure logo" width={106} height={30} priority />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
          >
            Login
          </Link>
          <Link
            href="/subscribe"
            className="inline-flex h-9 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            Subscribe
          </Link>
        </div>

        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white md:hidden"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation"
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMobileOpen ? (
        <div className="border-t border-white/10 bg-[#09090b] px-4 pb-5 pt-3 md:hidden">
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/login"
              onClick={() => setIsMobileOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 text-sm font-semibold text-zinc-100"
            >
              Login
            </Link>
            <Link
              href="/subscribe"
              onClick={() => setIsMobileOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-black"
            >
              Subscribe
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
