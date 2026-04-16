import Link from "next/link";
import { ArticleBrowser } from "../../components/ArticleBrowser";
import { SubscribeForm } from "../../components/SubscribeForm";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

export const revalidate = 1800;

const getArticles = async (): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url")
    .order("published_at", { ascending: false })
    .limit(40);

  return (data as ArticleRecord[] | null) ?? [];
};

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <div className="section-page">
      <section className="section-hero section-hero--dark">
        <p className="hero-kicker">Articles</p>
        <h1>Latest cybersecurity stories, rewritten daily.</h1>
        <p className="hero-subtext">
          Search by topic, filter by category, and read the highest-signal stories without the noise.
        </p>
        <div className="hero-links">
          <Link href="/" className="hero-secondary-link">
            Back to newsletter
          </Link>
          <Link href="/practices" className="hero-secondary-link">
            Browse practices
          </Link>
        </div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Search</p>
            <h2>Find the right article</h2>
            <p>Use search and category filters to narrow the feed to the exact story you want.</p>
          </div>
        </div>
        <ArticleBrowser articles={articles} />
      </section>

      <section className="cta-block">
        <h2>Get the daily briefing in your inbox</h2>
        <p>One clean digest. No filler. Just the articles worth your attention.</p>
        <SubscribeForm mode="subscribe" className="subscribe-form-cta" placeholder="Email Address" buttonLabelOverride="Subscribe" />
      </section>
    </div>
  );
}
