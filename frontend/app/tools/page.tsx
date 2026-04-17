import Link from "next/link";
import { CategoryBadge } from "../../components/CategoryBadge";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

export const runtime = "edge";

type ToolArticle = Pick<
  ArticleRecord,
  "id" | "slug" | "title" | "summary" | "category" | "published_at" | "image_url" | "source_name"
>;

const TOOL_CATEGORIES = ["ai-security", "industry-news", "vulnerabilities", "threat-intel"];

const getToolArticles = async (): Promise<ToolArticle[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,category,published_at,image_url,source_name")
    .in("category", TOOL_CATEGORIES)
    .order("published_at", { ascending: false })
    .limit(90);

  return (data as ToolArticle[] | null) ?? [];
};

const isToolFocused = (article: ToolArticle): boolean => {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return /(tool|platform|framework|scanner|agent|automation|open[-\s]?source|github|model)/.test(text);
};

export default async function Page() {
  const allArticles = await getToolArticles();
  const toolArticles = allArticles.filter(isToolFocused);
  const fallbackArticles = toolArticles.length > 0 ? toolArticles : allArticles;

  const sections = [
    {
      title: "Automation & AI Security",
      items: fallbackArticles
        .filter((article) => ["ai-security", "threat-intel"].includes(article.category))
        .slice(0, 6)
    },
    {
      title: "Platform & Vulnerability Tooling",
      items: fallbackArticles
        .filter((article) => ["vulnerabilities", "industry-news"].includes(article.category))
        .slice(0, 6)
    }
  ].filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Security Tools</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Curated tools and platform updates from current cybersecurity coverage.
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
              href="/practices"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Practices
            </Link>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No tools-focused updates are available yet.
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900">{section.title}</h2>
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
