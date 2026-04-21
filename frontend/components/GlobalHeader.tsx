"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const AUTH_KEY = "sevensecure_subscriber_email";

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
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeState, setSubscribeState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const isHome = pathname === "/";

  const refreshAuthState = () => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = (localStorage.getItem(AUTH_KEY) || "").trim().toLowerCase();
    setViewerEmail(stored);
    setIsLoggedIn(Boolean(stored));
  };

  useEffect(() => {
    refreshAuthState();

    const onAuthChanged = () => {
      refreshAuthState();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_KEY) {
        refreshAuthState();
      }
    };

    const onOpenSubscribe = () => {
      if (!isLoggedIn) {
        setIsSubscribeOpen(true);
      }
    };

    window.addEventListener("sevensecure-auth-changed", onAuthChanged as EventListener);
    window.addEventListener("storage", onStorage);
    window.addEventListener("open-subscribe-modal", onOpenSubscribe as EventListener);

    return () => {
      window.removeEventListener("sevensecure-auth-changed", onAuthChanged as EventListener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("open-subscribe-modal", onOpenSubscribe as EventListener);
    };
  }, [isLoggedIn]);

  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const closeSubscribeModal = () => {
    setIsSubscribeOpen(false);
    setSubscribeState("idle");
    setSubscribeMessage("");
    setSubscribeEmail("");
  };

  const handleOpenSubscribe = () => {
    if (isLoggedIn) {
      return;
    }
    setIsSubscribeOpen(true);
    setIsMobileOpen(false);
  };

  const handleSubscribe = async () => {
    const normalizedEmail = subscribeEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setSubscribeState("error");
      setSubscribeMessage("Enter a valid email address.");
      return;
    }

    setSubscribeState("submitting");
    setSubscribeMessage("Subscribing...");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: normalizedEmail, interests: [] })
      });

      if (!response.ok) {
        throw new Error("Subscribe request failed");
      }

      localStorage.setItem(AUTH_KEY, normalizedEmail);
      window.dispatchEvent(new CustomEvent("sevensecure-auth-changed", { detail: { email: normalizedEmail } }));
      setSubscribeState("success");
      setSubscribeMessage("Subscribed successfully.");

      setTimeout(() => {
        closeSubscribeModal();
      }, 700);
    } catch (error) {
      console.error("Header subscribe failed:", error);
      setSubscribeState("error");
      setSubscribeMessage("Subscription failed. Please try again.");
    }
  };

  const handleLogout = () => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(AUTH_KEY);
    window.dispatchEvent(new CustomEvent("sevensecure-auth-changed", { detail: { email: "" } }));
  };

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
          {isLoggedIn ? (
            <>
              <span className={isHome ? "text-xs font-medium text-zinc-300" : "text-xs font-medium text-zinc-600"}>
                Subscribed
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className={desktopButtonClasses}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={desktopButtonClasses}
              >
                Login
              </Link>
              <button
                type="button"
                onClick={handleOpenSubscribe}
                className={desktopButtonClasses}
              >
                Subscribe
              </button>
            </>
          )}
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
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  className={desktopButtonClasses.replace("h-9", "h-10")}
                  disabled
                >
                  Subscribed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setIsMobileOpen(false);
                  }}
                  className={desktopButtonClasses.replace("h-9", "h-10")}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsMobileOpen(false)}
                  className={desktopButtonClasses.replace("h-9", "h-10")}
                >
                  Login
                </Link>
                <button
                  type="button"
                  onClick={handleOpenSubscribe}
                  className={desktopButtonClasses.replace("h-9", "h-10")}
                >
                  Subscribe
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {isSubscribeOpen && !isLoggedIn ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Subscribe</h3>
              <button
                type="button"
                onClick={closeSubscribeModal}
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close subscribe popup"
              >
                <X size={18} />
              </button>
            </div>

            <label htmlFor="header-subscribe-email" className="mb-2 block text-sm font-medium text-zinc-700">
              Email address
            </label>
            <input
              id="header-subscribe-email"
              type="email"
              value={subscribeEmail}
              autoComplete="email"
              onChange={(event) => {
                setSubscribeEmail(event.target.value);
                if (subscribeState !== "idle") {
                  setSubscribeState("idle");
                  setSubscribeMessage("");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSubscribe();
                }
              }}
              placeholder="you@company.com"
              className="w-full rounded-md border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />

            {subscribeMessage ? (
              <p className={`mt-2 text-sm ${subscribeState === "error" ? "text-rose-600" : "text-zinc-600"}`}>
                {subscribeMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void handleSubscribe();
              }}
              disabled={subscribeState === "submitting"}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {subscribeState === "submitting" ? "Subscribing..." : "Subscribe"}
            </button>

            {viewerEmail ? (
              <p className="mt-3 text-xs text-zinc-500">Signed in as {viewerEmail}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
