import Link from "next/link";

interface SiteFooterProps {
  className?: string;
  roundedTop?: boolean;
}

export function SiteFooter({ className = "", roundedTop = true }: SiteFooterProps) {
  const shellClassName = [
    "w-full bg-white border-t border-zinc-200 py-16 px-6 relative z-10 mt-12 md:mt-24",
    roundedTop ? "rounded-t-[2.5rem]" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <footer className={shellClassName}>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="flex flex-col items-start gap-4 md:col-span-1">
          <img src="/7secure_logo.svg" alt="7secure logo" className="h-6 w-auto brightness-0" />
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            Empowering teams with actionable security intel directly to your inbox.
          </p>
          <div className="flex gap-4 mt-2">
            <a
              href="https://x.com"
              aria-label="X"
              className="w-8 h-8 rounded border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:text-black hover:border-zinc-400 transition-colors"
            >
              <span className="text-[11px] font-bold tracking-wide">X</span>
            </a>
            <a
              href="https://linkedin.com"
              aria-label="LinkedIn"
              className="w-8 h-8 rounded border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:text-blue-700 hover:border-blue-200 transition-colors"
            >
              <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-semibold text-zinc-900">Content</h4>
          <Link href="/articles" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Latest News</Link>
          <Link href="/practices" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Best Practices</Link>
          <Link href="/tools" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Trending Tools</Link>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-semibold text-zinc-900">Legal</h4>
          <Link href="/privacy" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Terms of Service</Link>
          <Link href="/cookies" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Cookie Policy</Link>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-semibold text-zinc-900">Company</h4>
          <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">About Us</Link>
          <Link href="/contact" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Contact</Link>
          <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Sign In</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-12 pt-8 border-t border-zinc-100 text-center md:text-left text-sm text-zinc-400">
        © 2026 7secure Inc. All rights reserved.
      </div>
    </footer>
  );
}
