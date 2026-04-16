import Link from "next/link";
import { sectionLinks } from "../lib/newsletter-content";

export function Header() {
  const navItems = sectionLinks.slice(0, 3);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo-link" aria-label="7secure homepage">
          <img src="/brand/7secure_logo.svg" alt="7secure" className="logo-mark" />
        </Link>
        <nav className="header-nav">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/subscribe" className="header-login-btn">
          Subscribe
        </Link>
      </div>
    </header>
  );
}
