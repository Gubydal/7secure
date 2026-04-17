"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, ShieldCheck, Star } from "lucide-react";
import {
  CATEGORY_META,
  normalizeCategory,
  type CategoryKey
} from "../../lib/category-meta";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

type PracticeArticle = Pick<
  ArticleRecord,
  "id" | "slug" | "title" | "summary" | "category" | "published_at" | "source_name"
>;

const PRACTICE_CATEGORIES: CategoryKey[] = [
  "vulnerabilities",
  "threat-intel",
  "research",
  "government"
];

const summaryToChecklist = (summary: string): string[] => {
  const parts = summary
    .split(/[.;]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return parts.slice(0, 3);
};

export default function Page() {
  const [articles, setArticles] = useState<PracticeArticle[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | CategoryKey>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPractices = async () => {
      const { data, error } = await supabasePublic
        .from("articles")
        .select("id,slug,title,summary,category,published_at,source_name")
        .in("category", PRACTICE_CATEGORIES)
        .order("published_at", { ascending: false })
        .limit(120);

      if (!isMounted) {
        return;
      }

      if (!error && data) {
        setArticles(data as PracticeArticle[]);
      }

      setIsLoading(false);
    };

    loadPractices();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const available = new Set<CategoryKey>(articles.map((article) => normalizeCategory(article.category)));
    const ordered = PRACTICE_CATEGORIES.filter((category) => available.has(category));
    return ["all" as const, ...(ordered.length ? ordered : PRACTICE_CATEGORIES)];
  }, [articles]);

  const filteredPractices = useMemo(() => {
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
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Practices</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Practical security playbooks and operational recommendations for active teams.
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-lg flex-1 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search practices, hardening, and response guides"
              className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
          <p className="text-sm text-zinc-500">
            Showing <span className="font-semibold text-zinc-800">{filteredPractices.length}</span> item
            {filteredPractices.length === 1 ? "" : "s"}
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
              <div key={index} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && filteredPractices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No practices matched this filter.
          </div>
        ) : null}

        {!isLoading && filteredPractices.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredPractices.map((article) => {
              const category = normalizeCategory(article.category);
              const CategoryIcon = CATEGORY_META[category].icon;
              const checklist = summaryToChecklist(article.summary);

              return (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700">
                          <ShieldCheck className="h-3 w-3" />
                          {CATEGORY_META[category].label}
                        </span>
                        <span>{article.source_name || "7secure"}</span>
                        <span>•</span>
                        <span>{new Date(article.published_at).toLocaleDateString()}</span>
                      </div>

                      <h2 className="mt-2 line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-blue-700">
                        {article.title}
                      </h2>

                      <div className="mt-3 grid gap-2">
                        {checklist.length > 0 ? (
                          checklist.map((point, index) => (
                            <p key={index} className="flex items-start gap-2 text-sm leading-6 text-zinc-600">
                              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-blue-600" />
                              <span className="line-clamp-2">{point}</span>
                            </p>
                          ))
                        ) : (
                          <p className="text-sm leading-6 text-zinc-600">{article.summary}</p>
                        )}
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
