import Link from "next/link";
import { SubscribeForm } from "./SubscribeForm";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-shell">
        <div className="footer-brand-col">
          <div className="footer-brand-row">
            <span className="logo-seven">7</span>
            <span className="logo-text">secure</span>
          </div>
          <p>
            Get the latest cyber and AI security developments in one fast daily briefing.
            Built for security teams, founders, and technical leaders.
          </p>
          <SubscribeForm
            mode="subscribe"
            className="subscribe-form-footer"
            placeholder="Email Address"
            buttonLabelOverride="Subscribe"
          />
        </div>

        <div className="footer-link-col">
          <h4>Stay Updated</h4>
          <Link href="/">Articles</Link>
          <Link href="/">Threat Intel</Link>
          <Link href="/">Guides</Link>
          <Link href="/subscribe">Subscribe</Link>
        </div>

        <div className="footer-link-col">
          <h4>Security University</h4>
          <Link href="/">Courses</Link>
          <Link href="/">Certifications</Link>
          <Link href="/">Labs</Link>
          <Link href="/">Workshops</Link>
        </div>

        <div className="footer-link-col">
          <h4>Company</h4>
          <Link href="/">Advertise</Link>
          <Link href="/">Careers</Link>
          <Link href="/">Contact</Link>
          <Link href="/unsubscribe">Unsubscribe</Link>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© 2026 7secure. All rights reserved.</p>
      </div>
    </footer>
  );
}
