import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBadge } from "../../../components/CategoryBadge";
import { SubscribeForm } from "../../../components/SubscribeForm";
import { MarkdownRenderer } from "../../../components/MarkdownRenderer";
import { formatDate } from "../../../lib/utils";
import { supabasePublic, type ArticleRecord } from "../../../lib/supabase";

export const runtime = "edge";

const getArticleBySlug = async (slug: string): Promise<ArticleRecord | null> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url")
    .eq("slug", slug)
    .single();

  return (data as ArticleRecord | null) ?? null;
};

const getRelated = async (category: string, currentSlug: string): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url")
    .eq("category", category)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3);

  return (data as ArticleRecord[] | null) ?? [];
};

// Removed generateStaticParams because Cloudflare Pages Edge Runtime does not support static param generation alongside the edge runtime.

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    return { title: "Article not found" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev";
  const url = `${siteUrl}/articles/${article.slug}`;

  return {
    title: `${article.title} | 7secure`,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      url,
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary
    }
  };
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return <p>Article not found.</p>;
  }

  const related = await getRelated(article.category, article.slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev";
  const articleUrl = `${siteUrl}/articles/${article.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary,
    datePublished: article.published_at,
    dateModified: article.published_at,
    mainEntityOfPage: articleUrl,
    publisher: {
      "@type": "Organization",
      name: "7secure"
    },
    author: {
      "@type": "Organization",
      name: "7secure Editorial"
    },
    url: articleUrl
  };

  return (
    <article className="article-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="article-hero">
        <CategoryBadge category={article.category} />
        <h1>{article.title}</h1>
        <p className="article-meta">
          {formatDate(article.published_at)} · Source: <a href={article.original_url}>{article.source_name}</a>
        </p>
        {article.image_url ? (
          <div className="article-hero-media">
            <img src={article.image_url} alt={article.title} />
          </div>
        ) : null}
      </div>

      <div className="article-content">
        <MarkdownRenderer content={article.content} />
      </div>

      <div className="article-actions">
        <Link href="/" className="article-back-link">Back to latest</Link>
        <Link href="/articles" className="article-back-link article-back-link--secondary">Browse articles</Link>
      </div>

      <section className="cta-block">
        <h2>Get the daily briefing in your inbox</h2>
        <p>One clean email. No filler. Just the stories and tools worth your time.</p>
        <SubscribeForm mode="subscribe" className="subscribe-form-cta" />
      </section>

      <section>
        <h3>Related in {article.category.replace(/-/g, " ")}</h3>
        <div className="related-grid">
          {related.map((item) => (
            <Link key={item.slug} href={`/articles/${item.slug}`} className="related-card">
              {item.image_url ? <img src={item.image_url} alt={item.title} /> : null}
              <div>
                <CategoryBadge category={item.category} />
                <h4>{item.title}</h4>
                <p>{item.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
