import Link from "next/link";
import { CategoryBadge } from "../components/CategoryBadge";
import { SubscribeForm } from "../components/SubscribeForm";
import { formatDate } from "../lib/utils";
import { supabasePublic, type ArticleRecord } from "../lib/supabase";

export const revalidate = 3600;

const getArticles = async (): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags")
    .order("published_at", { ascending: false })
    .limit(20);

  return (data as ArticleRecord[] | null) ?? [];
};

export default async function HomePage() {
  const articles = await getArticles();
  const featured = articles.find((article) => article.is_featured) || articles[0];
  const breaking = articles.filter((article) => article.category === "threat-intel").slice(0, 6);
  const remaining = articles.filter((article) => article.slug !== featured?.slug);
  const sideStories = remaining.slice(0, 4);
  const streamStories = remaining.slice(4, 12);
  const trustNames = ["Google", "Meta", "Cisco", "HubSpot", "IBM", "Microsoft"];

  return (
    <>
      <section className="landing-hero">
        <p className="hero-kicker">Daily Brief for Security Teams</p>
        <h1>
          Learn cybersecurity in
          <span> 5 minutes </span>
          a day.
        </h1>
        <p className="hero-subtext">
          Get high-signal threat intelligence, vulnerabilities, and AI security updates
          with the context your team needs to act quickly.
        </p>
        <SubscribeForm
          mode="subscribe"
          className="subscribe-form-hero"
          placeholder="Email Address"
          buttonLabelOverride="Subscribe"
        />
        <p className="trust-label">Read by security teams at:</p>
        <div className="trust-row">
          {trustNames.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      <section className="latest-section">
        <h2>Latest Articles</h2>
        <p>The latest developments in cybersecurity, infrastructure, and AI risk.</p>
        <div className="topic-filter-row">
          <button className="topic-filter active">All</button>
          <button className="topic-filter">Threat Intel</button>
          <button className="topic-filter">Vulnerabilities</button>
          <button className="topic-filter">Industry</button>
          <button className="topic-filter">AI Security</button>
        </div>

        <div className="latest-layout">
          {featured ? (
            <article className="spotlight-card">
              <div className="spotlight-media" />
              <CategoryBadge category={featured.category} />
              <h3>
                <Link href={`/articles/${featured.slug}`}>{featured.title}</Link>
              </h3>
              <p>{featured.summary}</p>
              <div className="article-meta">{formatDate(featured.published_at)}</div>
            </article>
          ) : null}

          <div className="side-story-stack">
            {sideStories.map((item) => (
              <article key={item.slug} className="side-story-card">
                <div className="side-story-media" />
                <CategoryBadge category={item.category} />
                <h4>
                  <Link href={`/articles/${item.slug}`}>{item.title}</Link>
                </h4>
                <div className="article-meta">{formatDate(item.published_at)}</div>
              </article>
            ))}
          </div>
        </div>

        <section className="breaking-strip" aria-label="Breaking threat intel">
          {breaking.map((item) => (
            <Link key={item.slug} href={`/articles/${item.slug}`} className="breaking-item">
              <strong>Threat Intel</strong>
              <span>{item.title}</span>
            </Link>
          ))}
        </section>

        <div className="stream-grid">
          {streamStories.map((item) => (
            <article key={item.slug} className="article-card">
              <CategoryBadge category={item.category} />
              <h3>
                <Link href={`/articles/${item.slug}`}>{item.title}</Link>
              </h3>
              <p>{item.summary}</p>
              <div className="article-meta">{formatDate(item.published_at)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-block">
        <h2>Never miss critical security updates</h2>
        <p>Join 7secure for your daily intelligence briefing in one email.</p>
        <SubscribeForm
          mode="subscribe"
          className="subscribe-form-cta"
          placeholder="Email Address"
          buttonLabelOverride="Subscribe"
        />
      </section>
    </>
  );
}
