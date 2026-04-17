import Link from "next/link";
import { CategoryBadge } from "../../components/CategoryBadge";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

export const runtime = "edge";

type PracticeArticle = Pick<
  ArticleRecord,
  "id" | "slug" | "title" | "summary" | "category" | "published_at" | "image_url" | "source_name"
>;

const PRACTICE_CATEGORIES = ["vulnerabilities", "threat-intel", "research", "government"];

const getPracticeArticles = async (): Promise<PracticeArticle[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,category,published_at,image_url,source_name")
    .in("category", PRACTICE_CATEGORIES)
    .order("published_at", { ascending: false })
    .limit(80);

  return (data as PracticeArticle[] | null) ?? [];
};

export default async function Page() {
  const articles = await getPracticeArticles();

  const sections = PRACTICE_CATEGORIES.map((category) => ({
    category,
    title: category.replace(/-/g, " "),
    items: articles.filter((article) => article.category === category).slice(0, 6)
  })).filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Security Practices</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Tactical playbooks and guidance to improve detection, response, and hardening.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Home
            </Link>
            <Link
              href="/tools"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Tools
            </Link>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No practice-focused articles are available yet.
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.category}>
                <h2 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900 capitalize">
                  {section.title}
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {section.items.map((article) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-zinc-100">
                        <img
                          src={article.image_url || "/cover.avif"}
                          alt={article.title}
                          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="space-y-3 p-5">
                        <CategoryBadge category={article.category} />
                        <h3 className="line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900">
                          {article.title}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{article.summary}</p>
                        <div className="flex items-center justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                          <span>{article.source_name || "7secure"}</span>
                          <span>{new Date(article.published_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
