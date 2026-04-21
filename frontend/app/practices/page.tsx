"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, ShieldCheck, Star } from "lucide-react";
import {
  buildCategoryList,
  getCategoryMeta,
  normalizeCategory,
  type CategoryKey
} from "../../lib/category-meta";
import { supabasePublic, type ArticleRecord } from "../../lib/supabase";

type PracticeArticle = Pick<
  ArticleRecord,
  "id" | "slug" | "title" | "summary" | "category" | "published_at" | "source_name"
>;

const PRACTICE_KEYWORDS =
  /(practice|playbook|guide|checklist|hardening|mitigation|response|defense|incident|baseline|detection|remediation|compliance|policy)/i;

const isPracticeFocused = (article: PracticeArticle): boolean => {
  const signal = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
  if (PRACTICE_KEYWORDS.test(signal)) {
    return true;
  }

  const category = normalizeCategory(article.category);
  return /(vulnerab|threat|research|government|compliance|security-control)/.test(category);
};

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
        .order("published_at", { ascending: false })
        .limit(180);

      if (!isMounted) {
        return;
      }

      if (!error && data) {
        const initial = data as PracticeArticle[];
        const focused = initial.filter((article) => isPracticeFocused(article));
        setArticles((focused.length > 0 ? focused : initial).slice(0, 120));
      }

      setIsLoading(false);
    };

    loadPractices();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const dynamic = buildCategoryList(articles.map((article) => article.category), 10);
    return ["all" as const, ...dynamic];
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

        <div className="mb-8 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {categoryOptions.map((category) => {
            const isAll = category === "all";
            const meta = isAll ? null : getCategoryMeta(category);
            const Icon = isAll ? Star : meta!.icon;
            const label = isAll ? "All" : meta!.label;

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
              const categoryMeta = getCategoryMeta(category);
              const CategoryIcon = categoryMeta.icon;
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
                          {categoryMeta.label}
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
