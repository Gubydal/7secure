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
  const isHome = pathname === "/";
  const subscribeHref = isHome ? "/?subscribe=1" : "/subscribe";

  const headerClasses = isHome
    ? "border-b border-white/10 bg-[#09090b]/95 backdrop-blur-md"
    : "border-b border-zinc-200 bg-white";

  const navLinkClasses = (active: boolean): string => {
    if (isHome) {
      return active ? "text-white" : "text-zinc-400 hover:text-zinc-100";
    }

    return active ? "text-zinc-950" : "text-zinc-600 hover:text-zinc-900";
  };

  const desktopButtonClasses = isHome
    ? "inline-flex h-9 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
    : "inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700";

  const mobilePanelClasses = isHome
    ? "border-t border-white/10 bg-[#09090b]"
    : "border-t border-zinc-200 bg-white";

  const mobileNavClasses = (active: boolean): string => {
    if (isHome) {
      return active
        ? "bg-zinc-800 text-white"
        : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100";
    }

    return active
      ? "bg-zinc-900 text-white"
      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900";
  };

  const mobileToggleClasses = isHome
    ? "inline-flex items-center justify-center rounded-md p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white md:hidden"
    : "inline-flex items-center justify-center rounded-md p-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 md:hidden";

  return (
    <header className={`fixed left-0 right-0 top-0 z-50 ${headerClasses}`}>
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" onClick={() => setIsMobileOpen(false)}>
          <Image
            src="/7secure_logo.svg"
            alt="7secure logo"
            width={106}
            height={30}
            priority
            className={isHome ? "" : "invert"}
          />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${navLinkClasses(active)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={desktopButtonClasses}
          >
            Login
          </Link>
          <Link
            href={subscribeHref}
            className={desktopButtonClasses}
          >
            Subscribe
          </Link>
        </div>

        <button
          className={mobileToggleClasses}
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation"
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMobileOpen ? (
        <div className={`px-4 pb-5 pt-3 md:hidden ${mobilePanelClasses}`}>
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${mobileNavClasses(active)}`}
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
              className={desktopButtonClasses.replace("h-9", "h-10")}
            >
              Login
            </Link>
            <Link
              href={subscribeHref}
              onClick={() => setIsMobileOpen(false)}
              className={desktopButtonClasses.replace("h-9", "h-10")}
            >
              Subscribe
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
