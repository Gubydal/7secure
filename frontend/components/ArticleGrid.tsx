import type { ArticleRecord } from "../lib/supabase";
import { ArticleCard } from "./ArticleCard";

interface ArticleGridProps {
  articles: ArticleRecord[];
}

export function ArticleGrid({ articles }: ArticleGridProps) {
  return (
    <section className="article-grid">
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </section>
  );
}
