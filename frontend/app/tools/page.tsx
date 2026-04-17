"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search, Star, Wrench } from "lucide-react";
import {
  CATEGORY_META,
  normalizeCategory,
  type CategoryKey
} from "../../lib/category-meta";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

type ToolArticle = Pick<
  ArticleRecord,
  "id" | "slug" | "title" | "summary" | "category" | "published_at" | "source_name"
>;

const TOOL_CATEGORIES: CategoryKey[] = [
  "ai-security",
  "industry-news",
  "vulnerabilities",
  "threat-intel"
];

const TOOL_KEYWORDS = /(tool|platform|framework|scanner|agent|automation|open[-\s]?source|github|model|cli|integration)/i;

export default function Page() {
  const [articles, setArticles] = useState<ToolArticle[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | CategoryKey>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTools = async () => {
      const { data, error } = await supabasePublic
        .from("articles")
        .select("id,slug,title,summary,category,published_at,source_name")
        .in("category", TOOL_CATEGORIES)
        .order("published_at", { ascending: false })
        .limit(120);

      if (!isMounted) {
        return;
      }

      if (!error && data) {
        const initial = data as ToolArticle[];
        const focused = initial.filter((article) =>
          TOOL_KEYWORDS.test(`${article.title} ${article.summary}`)
        );
        setArticles(focused.length > 0 ? focused : initial);
      }

      setIsLoading(false);
    };

    loadTools();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const available = new Set<CategoryKey>(articles.map((article) => normalizeCategory(article.category)));
    const ordered = TOOL_CATEGORIES.filter((category) => available.has(category));

    return ["all" as const, ...(ordered.length ? ordered : TOOL_CATEGORIES)];
  }, [articles]);

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return articles.filter((article) => {
      const category = normalizeCategory(article.category);
      const matchesCategory = activeCategory === "all" || category === activeCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = `${article.title} ${article.summary} ${article.source_name || ""}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [activeCategory, articles, query]);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tools</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Discovery feed for security tools, frameworks, and operational integrations.
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-lg flex-1 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools, frameworks, or platforms"
              className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
          <p className="text-sm text-zinc-500">
            Showing <span className="font-semibold text-zinc-800">{filteredTools.length}</span> item
            {filteredTools.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {categoryOptions.map((category) => {
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

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && filteredTools.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No tools matched this filter.
          </div>
        ) : null}

        {!isLoading && filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredTools.map((article) => {
              const category = normalizeCategory(article.category);
              const CategoryIcon = CATEGORY_META[category].icon;

              return (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="group rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900">{article.title}</h2>
                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-700" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{article.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-medium text-zinc-700">
                          <Wrench className="h-3 w-3" />
                          {CATEGORY_META[category].label}
                        </span>
                        <span>{article.source_name || "7secure"}</span>
                        <span>•</span>
                        <span>{new Date(article.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
