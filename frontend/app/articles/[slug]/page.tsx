import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { CategoryBadge } from "../../../components/CategoryBadge";
import { SubscribeForm } from "../../../components/SubscribeForm";
import { formatDate } from "../../../lib/utils";
import { supabasePublic, type ArticleRecord } from "../../../lib/supabase";

export const revalidate = 86400;

const getArticleBySlug = async (slug: string): Promise<ArticleRecord | null> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags")
    .eq("slug", slug)
    .single();

  return (data as ArticleRecord | null) ?? null;
};

const getRelated = async (category: string, currentSlug: string): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags")
    .eq("category", category)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3);

  return (data as ArticleRecord[] | null) ?? [];
};

export async function generateStaticParams() {
  const { data } = await supabasePublic.from("articles").select("slug");
  return (data ?? []).map((row: { slug: string }) => ({ slug: row.slug }));
}

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

      <CategoryBadge category={article.category} />
      <h1>{article.title}</h1>
      <p className="article-meta">
        {formatDate(article.published_at)} · Source: <a href={article.original_url}>{article.source_name}</a>
      </p>

      <div className="article-content">
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </div>

      <p>
        <Link href="/">Back to latest</Link>
      </p>

      <section className="cta-block">
        <h2>Get the daily briefing in your inbox</h2>
        <SubscribeForm mode="subscribe" />
      </section>

      <section>
        <h3>Related in {article.category.replace(/-/g, " ")}</h3>
        <div className="related-grid">
          {related.map((item) => (
            <div key={item.slug} className="article-card">
              <h4>
                <Link href={`/articles/${item.slug}`}>{item.title}</Link>
              </h4>
              <p>{item.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
