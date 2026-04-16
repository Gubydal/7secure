import Link from "next/link";
import { EditorialCard } from "../../components/EditorialCard";
import { SubscribeForm } from "../../components/SubscribeForm";
import { practiceCards } from "../../lib/newsletter-content";

export default function PracticesPage() {
  return (
    <div className="section-page">
      <section className="section-hero section-hero--dark">
        <p className="hero-kicker">Practices</p>
        <h1>Practical security plays for busy teams.</h1>
        <p className="hero-subtext">
          Reusable checklists, routines, and templates that make the day-to-day security workflow easier.
        </p>
        <div className="hero-links">
          <Link href="/articles" className="hero-secondary-link">
            Back to articles
          </Link>
          <Link href="/tools" className="hero-secondary-link">
            Browse tools
          </Link>
        </div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Curated plays</p>
            <h2>Practices worth adopting</h2>
            <p>Short, actionable cards you can use to improve triage, hardening, and response workflows.</p>
          </div>
        </div>
        <div className="section-grid section-grid--four">
          {practiceCards.map((card) => (
            <EditorialCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="cta-block">
        <h2>Get the daily briefing in your inbox</h2>
        <p>Pair practical routines with the day’s security news in one readable email.</p>
        <SubscribeForm mode="subscribe" className="subscribe-form-cta" placeholder="Email Address" buttonLabelOverride="Subscribe" />
      </section>
    </div>
  );
}
