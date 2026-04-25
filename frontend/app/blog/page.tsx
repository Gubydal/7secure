import Link from "next/link";
import { supabasePublic } from "../../lib/supabase";

interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_at: string;
  image_url?: string | null;
}

export default async function BlogPage() {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,category,published_at,image_url")
    .order("published_at", { ascending: false })
    .limit(24);

  const articles = (data || []) as BlogArticle[];

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Blog</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Editorial articles, analysis, and long-form security commentary from the 7secure team.
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No blog posts yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
              >
                <div className="aspect-[16/9] overflow-hidden bg-zinc-100">
                  <img
                    src={article.image_url || "/cover.avif"}
                    alt={article.title}
                    className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {article.category.replace(/-/g, " ")}
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{article.title}</h2>
                  <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{article.summary}</p>
                  <p className="text-xs text-zinc-400">{new Date(article.published_at).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
