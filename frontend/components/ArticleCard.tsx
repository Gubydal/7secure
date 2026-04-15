import Link from "next/link";
import { formatDate } from "../lib/utils";
import { CategoryBadge } from "./CategoryBadge";

interface ArticleCardProps {
  article: {
    slug: string;
    title: string;
    summary: string;
    category: string;
    published_at: string;
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="article-card">
      <CategoryBadge category={article.category} />
      <h3>
        <Link href={`/articles/${article.slug}`}>{article.title}</Link>
      </h3>
      <p>{article.summary}</p>
      <div className="article-meta">{formatDate(article.published_at)}</div>
    </article>
  );
}
