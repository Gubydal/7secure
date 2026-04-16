import Link from 'next/link';
import { supabasePublic, type ArticleRecord } from '../lib/supabase';
import { SubscribeForm } from '../components/SubscribeForm';

export const revalidate = 3600;

const getArticles = async (): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from('articles')
    .select('id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url')
    .order('published_at', { ascending: false })
    .limit(10);
  return (data as ArticleRecord[] | null) ?? [];
};

export default async function HomePage() {
  const articles = await getArticles();
  const featured = articles[0] || null;
  const recentList = articles.slice(1, 6);

  return (
    <main>
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">The latest in Cybersecurity.</h1>
          <p className="hero-subtext">Stay secure and informed with our daily newsletter reporting on threat intel, tools, and practices.</p>
          <SubscribeForm mode="subscribe" className="subscribe-form" placeholder="Email Address" buttonLabelOverride="Subscribe" />
        </div>
      </section>

      <div className="main-content">
        <div className="section-heading">
          <h2>Latest Updates</h2>
          <Link href="/articles" className="show-more">Show all articles ?</Link>
        </div>

        {featured && (
          <div className="featured-article">
            {featured.image_url && <img src={featured.image_url} alt={featured.title} />}
            <Link href={\/articles/\\} className="article-title featured-title">{featured.title}</Link>
            <p className="article-summary">{featured.summary}</p>
          </div>
        )}

        <div className="article-list">
          {recentList.map(a => (
            <div key={a.id} className="article-item">
              <Link href={\/articles/\\} className="article-title">{a.title}</Link>
              <div className="article-meta">
                <span>{new Date(a.published_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{a.source_name}</span>
              </div>
              <p className="article-summary">{a.summary}</p>
            </div>
          ))}
        </div>

        <div className="section-heading">
          <h2>Practices & Frameworks</h2>
          <Link href="/practices" className="show-more">Show all practices ?</Link>
        </div>
        <div className="article-list">
            <div className="article-item">
              <Link href="/practices" className="article-title">Implementing Zero Trust Architecture</Link>
              <p className="article-summary">A step-by-step guide to removing implicit trust from your networks.</p>
            </div>
            <div className="article-item">
              <Link href="/practices" className="article-title">Incident Response Playbooks</Link>
              <p className="article-summary">Templates and best practices for reacting to breaches efficiently.</p>
            </div>
        </div>

        <div className="section-heading">
          <h2>Essential Tools</h2>
          <Link href="/tools" className="show-more">Show all tools ?</Link>
        </div>
        <div className="article-list">
            <div className="article-item">
              <Link href="/tools" className="article-title">Top 10 Open Source SIEMs</Link>
              <p className="article-summary">An evaluation of the most active open source security event managers.</p>
            </div>
        </div>
      </div>
    </main>
  );
}
