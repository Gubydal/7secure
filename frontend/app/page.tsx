import Link from "next/link";
import { CategoryBadge } from "../components/CategoryBadge";
import { EditorialCard } from "../components/EditorialCard";
import { SubscribeForm } from "../components/SubscribeForm";
import { formatDate } from "../lib/utils";
import { practiceCards, toolCards, trustSignals } from "../lib/newsletter-content";
import { supabasePublic, type ArticleRecord } from "../lib/supabase";

export const revalidate = 3600;

const getArticles = async (): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url")
    .order("published_at", { ascending: false })
    .limit(20);

  return (data as ArticleRecord[] | null) ?? [];
};

export default async function HomePage() {
  const articles = await getArticles();
  const featured = articles.find((article) => article.is_featured) || articles[0];
  const remaining = articles.filter((article) => article.slug !== featured?.slug);
  const sideStories = remaining.slice(0, 4);

  return (
    <div className="newsletter-shell">
      <section className="landing-hero">
        <p className="hero-kicker">Daily security briefing</p>
        <h1>
          Learn cyber in
          <span> 5 minutes </span>
          a day.
        </h1>
        <p className="hero-subtext">
          Get high-signal threat intelligence, practical security habits, and trending tools in one fast read.
        </p>
        <div className="hero-actions">
          <SubscribeForm
            mode="subscribe"
            className="subscribe-form-hero"
            placeholder="Email Address"
            buttonLabelOverride="Subscribe"
          />
          <div className="hero-links">
            <Link href="/articles" className="hero-secondary-link">
              Browse articles
            </Link>
            <Link href="/practices" className="hero-secondary-link">
              Explore practices
            </Link>
          </div>
        </div>
        <p className="trust-label">Trusted by teams using</p>
        <div className="trust-row">
          {trustSignals.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Latest articles</p>
            <h2>Latest Articles</h2>
            <p>The latest cybersecurity stories rewritten into concise blocks that are easy to scan.</p>
          </div>
          <Link href="/articles" className="section-more-link">
            Show more
          </Link>
        </div>

        <div className="latest-layout">
          {featured ? (
            <article className="spotlight-card">
              <Link href={`/articles/${featured.slug}`} className="spotlight-media">
                {featured.image_url ? (
                  <img src={featured.image_url} alt={featured.title} />
                ) : null}
              </Link>
              <div className="spotlight-body">
                <CategoryBadge category={featured.category} />
                <h3>
                  <Link href={`/articles/${featured.slug}`}>{featured.title}</Link>
                </h3>
                <p>{featured.summary}</p>
                <div className="article-meta-row">
                  <div className="article-meta">{formatDate(featured.published_at)}</div>
                  <Link href={`/articles/${featured.slug}`} className="article-inline-link">
                    Read story
                  </Link>
                </div>
              </div>
            </article>
          ) : null}

          <div className="side-story-stack">
            {sideStories.map((item) => (
              <article key={item.slug} className="side-story-card">
                <Link href={`/articles/${item.slug}`} className="side-story-media">
                  {item.image_url ? <img src={item.image_url} alt={item.title} /> : null}
                </Link>
                <div className="side-story-body">
                  <CategoryBadge category={item.category} />
                  <h4>
                    <Link href={`/articles/${item.slug}`}>{item.title}</Link>
                  </h4>
                  <div className="article-meta">{formatDate(item.published_at)}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Practices</p>
            <h2>Practical security plays</h2>
            <p>Reusable playbooks, checklists, and routines for the work that keeps your team moving.</p>
          </div>
          <Link href="/practices" className="section-more-link">
            Show more
          </Link>
        </div>
        <div className="section-grid section-grid--four">
          {practiceCards.map((card) => (
            <EditorialCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Trending tools</p>
            <h2>Tools worth keeping open</h2>
            <p>The references and utilities that reduce guesswork when something needs checking fast.</p>
          </div>
          <Link href="/tools" className="section-more-link">
            Show more
          </Link>
        </div>
        <div className="section-grid section-grid--four">
          {toolCards.map((card) => (
            <EditorialCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="cta-block">
        <h2>Never miss critical security updates</h2>
        <p>Join 7secure for your daily intelligence briefing in one modern email.</p>
        <SubscribeForm
          mode="subscribe"
          className="subscribe-form-cta"
          placeholder="Email Address"
          buttonLabelOverride="Subscribe"
        />
      </section>
    </div>
  );
}
