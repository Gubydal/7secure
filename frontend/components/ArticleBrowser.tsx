"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ArticleRecord } from "../lib/supabase";
import { articleSectionFilters } from "../lib/newsletter-content";
import { ArticleGrid } from "./ArticleGrid";

interface ArticleBrowserProps {
  articles: ArticleRecord[];
}

const toCategorySlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function ArticleBrowser({ articles }: ArticleBrowserProps) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const activeSlug = activeCategory === "All" ? "all" : toCategorySlug(activeCategory);
    return articles.filter((article) => {
      const matchesCategory = activeSlug === "all" || article.category.toLowerCase() === activeSlug;
      const searchable = [article.title, article.summary, article.source_name, ...(article.tags || [])]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [articles, activeCategory, query]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(draftQuery);
  };

  return (
    <div className="article-browser">
      <form className="search-bar" onSubmit={onSubmit}>
        <input
          type="search"
          placeholder="Search articles, sources, or tags"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="filter-row" aria-label="Article filters">
        {articleSectionFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`pill-filter ${activeCategory === filter ? "is-active" : ""}`.trim()}
            onClick={() => setActiveCategory(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="section-count-row">
        <span>{filtered.length} articles</span>
        <button
          type="button"
          className="text-action"
          onClick={() => {
            setDraftQuery("");
            setQuery("");
            setActiveCategory("All");
          }}
        >
          Reset filters
        </button>
      </div>

      <ArticleGrid articles={filtered} />
    </div>
  );
}
