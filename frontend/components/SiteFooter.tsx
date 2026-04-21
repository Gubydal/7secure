import Link from "next/link";

interface SiteFooterProps {
  className?: string;
  roundedTop?: boolean;
}

function XBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933zm-1.291 19.493h2.039L6.486 3.248H4.298z" />
    </svg>
  );
}

function LinkedInBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function InstagramBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5c3.176 0 5.75-2.574 5.75-5.75v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 2h8.5A3.75 3.75 0 0 1 20 7.75v8.5A3.75 3.75 0 0 1 16.25 20h-8.5A3.75 3.75 0 0 1 4 16.25v-8.5A3.75 3.75 0 0 1 7.75 4zm8.9 1.45a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  );
}

function RedditBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" />
    </svg>
  );
}

export function SiteFooter({ className = "", roundedTop = true }: SiteFooterProps) {
  const shellClassName = [
    "w-full bg-white border-t border-zinc-200 py-16 px-6 relative z-10",
    roundedTop ? "mt-12 rounded-t-[1.5rem] md:mt-20 md:rounded-t-[1.8rem]" : "mt-0",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const socialButtonClassName =
    "flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900";

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
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className={socialButtonClassName}
            >
              <XBrandIcon />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className={socialButtonClassName}
            >
              <LinkedInBrandIcon />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={socialButtonClassName}
            >
              <InstagramBrandIcon />
            </a>
            <a
              href="https://reddit.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Reddit"
              className={socialButtonClassName}
            >
              <RedditBrandIcon />
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
