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
      <path d="M24 11.695c0-1.34-1.104-2.43-2.463-2.43-.665 0-1.268.261-1.713.683-1.697-1.16-3.973-1.91-6.5-2.008l1.097-3.452 2.991.699c.003 1.27 1.049 2.298 2.335 2.298 1.288 0 2.335-1.032 2.335-2.304s-1.047-2.304-2.335-2.304c-.92 0-1.714.526-2.094 1.292l-3.376-.79c-.18-.04-.365.06-.421.234l-1.224 3.846c-2.795.074-5.305.828-7.149 2.004-.444-.407-1.036-.659-1.688-.659C1.104 9.265 0 10.355 0 11.695c0 .89.489 1.664 1.209 2.09-.047.214-.074.435-.074.659 0 3.383 4.016 6.126 8.97 6.126s8.97-2.743 8.97-6.126c0-.215-.024-.426-.068-.631.749-.422 1.26-1.208 1.26-2.118zm-17.55 1.534c0-.965.8-1.748 1.786-1.748.987 0 1.787.783 1.787 1.748 0 .965-.8 1.748-1.787 1.748-.986 0-1.786-.783-1.786-1.748zm9.938 4.037c-.784.784-2.302 1.133-3.791 1.133-1.488 0-3.006-.35-3.79-1.133-.3-.3-.3-.786 0-1.085.3-.3.787-.3 1.086 0 .402.402 1.313.686 2.704.686 1.39 0 2.302-.284 2.703-.686.3-.3.786-.3 1.086 0 .3.299.3.786 0 1.085zm-.25-2.245c-.987 0-1.787-.783-1.787-1.748 0-.965.8-1.748 1.787-1.748.986 0 1.786.783 1.786 1.748 0 .965-.8 1.748-1.786 1.748z" />
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
