import Link from "next/link";
import { EditorialCard } from "../../components/EditorialCard";
import { SubscribeForm } from "../../components/SubscribeForm";
import { toolCards } from "../../lib/newsletter-content";

export default function ToolsPage() {
  return (
    <div className="section-page">
      <section className="section-hero section-hero--dark">
        <p className="hero-kicker">Tools</p>
        <h1>Trending tools that save time during analysis.</h1>
        <p className="hero-subtext">
          Keep the references, scanners, and workflow helpers you use most often in one clean section.
        </p>
        <div className="hero-links">
          <Link href="/articles" className="hero-secondary-link">
            Back to articles
          </Link>
          <Link href="/practices" className="hero-secondary-link">
            Browse practices
          </Link>
        </div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Trending tools</p>
            <h2>Useful security utilities</h2>
            <p>A compact list of tools and references that can stay open while you work through the day.
            </p>
          </div>
        </div>
        <div className="section-grid section-grid--four">
          {toolCards.map((card) => (
            <EditorialCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="cta-block">
        <h2>Get the daily briefing in your inbox</h2>
        <p>News, practices, and tools delivered in one focused digest.</p>
        <SubscribeForm mode="subscribe" className="subscribe-form-cta" placeholder="Email Address" buttonLabelOverride="Subscribe" />
      </section>
    </div>
  );
}
