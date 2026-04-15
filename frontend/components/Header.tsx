import Link from "next/link";

export function Header() {
  const navItems = [
    { label: "Threat Intel", href: "/threat-intel" },
    { label: "Vulnerabilities", href: "/vulnerabilities" },
    { label: "AI Security", href: "/ai-security" },
    { label: "Tools", href: "/tools" },
    { label: "Sponsor", href: "/sponsor" }
  ];

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo-link" aria-label="7secure homepage">
          <span className="logo-seven">7</span>
          <span className="logo-text">secure</span>
        </Link>
        <nav className="header-nav">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/subscribe" className="header-login-btn">
          Log in
        </Link>
      </div>
    </header>
  );
}
