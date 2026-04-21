"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const AUTH_KEY = "sevensecure_subscriber_email";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = (localStorage.getItem(AUTH_KEY) || "").trim().toLowerCase();
    if (stored) {
      setLoggedInEmail(stored);
      setEmail(stored);
    }
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Please enter your email.");
      return;
    }

    setStatus("submitting");
    setMessage("Checking your subscription...");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const payload = (await response.json()) as { success?: boolean; error?: string; email?: string };
      if (!response.ok || !payload.success) {
        setStatus("error");
        setMessage(payload.error || "Login failed.");
        return;
      }

      localStorage.setItem(AUTH_KEY, normalizedEmail);
      window.dispatchEvent(new CustomEvent("sevensecure-auth-changed", { detail: { email: normalizedEmail } }));

      setLoggedInEmail(normalizedEmail);
      setStatus("success");
      setMessage("Logged in.");

      setTimeout(() => {
        router.push("/");
      }, 450);
    } catch (error) {
      console.error("Login request failed:", error);
      setStatus("error");
      setMessage("Unable to login right now. Please try again.");
    }
  };

  const handleLogout = () => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(AUTH_KEY);
    window.dispatchEvent(new CustomEvent("sevensecure-auth-changed", { detail: { email: "" } }));
    setLoggedInEmail("");
    setStatus("idle");
    setMessage("You are logged out.");
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-14 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Login</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Use your subscribed email to access your account session.
          </p>

          {loggedInEmail ? (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">Logged in as {loggedInEmail}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                Logout
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-zinc-700">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (status !== "idle") {
                      setStatus("idle");
                      setMessage("");
                    }
                  }}
                  placeholder="you@company.com"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                />
              </div>

              {message ? (
                <p className={`text-sm ${status === "error" ? "text-rose-600" : "text-zinc-600"}`}>
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "submitting" ? "Checking..." : "Login"}
              </button>
            </form>
          )}

          <Link
            href="/"
            className="mt-6 inline-flex text-sm font-medium text-zinc-600 underline underline-offset-4 transition-colors hover:text-zinc-900"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
