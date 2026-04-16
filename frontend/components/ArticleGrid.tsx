import type { ArticleRecord } from "../lib/supabase";
import { ArticleCard } from "./ArticleCard";

interface ArticleGridProps {
  articles: ArticleRecord[];
  compact?: boolean;
}

export function ArticleGrid({ articles, compact = false }: ArticleGridProps) {
  return (
    <section className="article-grid">
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} compact={compact} />
      ))}
    </section>
  );
}
