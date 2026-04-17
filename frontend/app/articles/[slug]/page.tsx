import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBadge } from "../../../components/CategoryBadge";
import { SubscribeForm } from "../../../components/SubscribeForm";
import { MarkdownRenderer } from "../../../components/MarkdownRenderer";
import { formatDate } from "../../../lib/utils";
import { supabasePublic, type ArticleRecord } from "../../../lib/supabase";

export const runtime = "edge";

const stripLeadingHeading = (content: string): string =>
  content
    .replace(/^\uFEFF/, "")
    .replace(/^#{1,3}\s+.*?(?:\r?\n)+/, "")
    .trim();

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
  const heroImage = article.image_url || "/cover.avif";
  const renderedContent = stripLeadingHeading(article.content);

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
    <div className="min-h-screen bg-[#09090b] text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-zinc-400">
        <Link href="/" className="transition-colors hover:text-white">Back to latest</Link>
        <Link href="/articles" className="transition-colors hover:text-white">Browse articles</Link>
      </div>

      <article className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_32px_90px_rgba(0,0,0,0.28)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="p-6 sm:p-8 lg:p-12">
            <CategoryBadge category={article.category} />
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
              {article.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
              {article.summary}
            </p>
            <p className="mt-6 text-sm font-medium text-zinc-500">
              {formatDate(article.published_at)} · Source: <a href={article.original_url} className="text-zinc-700 underline-offset-4 hover:text-zinc-950 hover:underline">{article.source_name}</a>
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {(article.tags || []).slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                  {tag.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[320px] bg-zinc-100 lg:min-h-full">
            <img src={heroImage} alt={article.title} className="h-full w-full object-cover object-center" />
          </div>
        </div>

        <div className="border-t border-zinc-200 px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
          <MarkdownRenderer content={renderedContent} />
        </div>

        <div className="border-t border-zinc-200 px-6 py-8 sm:px-8 lg:px-12">
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950">
              Back to latest
            </Link>
            <Link href="/articles" className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950">
              Browse articles
            </Link>
          </div>
        </div>

        <div className="border-t border-zinc-200 px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Related articles</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.slug} href={`/articles/${item.slug}`} className="group overflow-hidden rounded-[1.2rem] border border-zinc-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="aspect-[16/10] overflow-hidden bg-zinc-100">
                  <img
                    src={item.image_url || "/cover.avif"}
                    alt={item.title}
                    className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="space-y-3 p-5">
                  <CategoryBadge category={item.category} />
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950">{item.title}</h3>
                  <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{item.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <section className="border-t border-zinc-200 bg-zinc-50 px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Get the daily briefing in your inbox</h2>
            <p className="mt-3 text-base leading-7 text-zinc-600">One clean email. No filler. Just the stories and tools worth your time.</p>
            <SubscribeForm mode="subscribe" variant="light" className="mt-6 w-full subscribe-form-cta" />
          </div>
        </section>
      </article>
    </div>
  </div>
  );
}
