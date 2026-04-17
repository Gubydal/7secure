"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { CategoryBadge } from "../../components/CategoryBadge";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  normalizeCategory,
  type CategoryKey
} from "../../lib/category-meta";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

type ListArticle = Pick<
  ArticleRecord,
  "id" | "slug" | "title" | "summary" | "category" | "published_at" | "image_url" | "source_name"
>;

export default function Page() {
  const [articles, setArticles] = useState<ListArticle[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | CategoryKey>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadArticles = async () => {
      const { data, error } = await supabasePublic
        .from("articles")
        .select("id,slug,title,summary,category,published_at,image_url,source_name")
        .order("published_at", { ascending: false })
        .limit(120);

      if (!isMounted) {
        return;
      }

      if (!error && data) {
        setArticles(data as ListArticle[]);
      }

      setIsLoading(false);
    };

    loadArticles();

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Set<CategoryKey>(articles.map((article) => normalizeCategory(article.category)));
    const ordered = CATEGORY_ORDER.filter((category) => unique.has(category));
    return ["all" as const, ...(ordered.length ? ordered : CATEGORY_ORDER)];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return articles.filter((article) => {
      const category = normalizeCategory(article.category);
      const categoryMatches = activeCategory === "all" || category === activeCategory;

      if (!categoryMatches) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = [article.title, article.summary, article.source_name || "", article.category]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [activeCategory, articles, query]);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">All Articles</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Browse all published updates, filter by category, and search by topic.
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

        <div className="mb-8">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-lg flex-1 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, source, or summary"
                className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
            <p className="text-sm text-zinc-500">
              Showing <span className="font-semibold text-zinc-800">{filteredArticles.length}</span> article
              {filteredArticles.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {categories.map((category) => {
              const isAll = category === "all";
              const Icon = isAll ? Star : CATEGORY_META[category].icon;
              const label = isAll ? "All" : CATEGORY_META[category].label;

              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-5 text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && filteredArticles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No articles found for this filter.
          </div>
        ) : null}

        {!isLoading && filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredArticles.map((article) => (
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
                  <CategoryBadge category={normalizeCategory(article.category)} />
                  <h2 className="line-clamp-2 text-xl font-semibold tracking-tight text-zinc-900">{article.title}</h2>
                  <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{article.summary}</p>
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                    <span>{article.source_name || "7secure"}</span>
                    <span>{new Date(article.published_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
