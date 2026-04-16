import Link from "next/link";
import { SubscribeForm } from "./SubscribeForm";
import { sectionLinks } from "../lib/newsletter-content";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-shell">
        <div className="footer-brand-col">
          <div className="footer-brand-row">
            <img src="/brand/7secure_logo.svg" alt="7secure" className="footer-logo" />
          </div>
          <p>
            A focused cybersecurity newsletter with articles, practices, and tools designed to keep the daily read sharp.
          </p>
          <SubscribeForm
            mode="subscribe"
            className="subscribe-form-footer"
            placeholder="Email Address"
            buttonLabelOverride="Subscribe"
          />
        </div>

        <div className="footer-link-col">
          <h4>Explore</h4>
          {sectionLinks.map((item) => (
            <Link key={item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="footer-link-col">
          <h4>Daily Read</h4>
          <Link href="/">Newsletter</Link>
          <Link href="/articles">Latest Articles</Link>
          <Link href="/practices">Practices</Link>
          <Link href="/tools">Tools</Link>
        </div>

        <div className="footer-link-col">
          <h4>Support</h4>
          <Link href="/subscribe">Subscribe</Link>
          <Link href="/unsubscribe">Unsubscribe</Link>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© 2026 7secure. All rights reserved.</p>
      </div>
    </footer>
  );
}
