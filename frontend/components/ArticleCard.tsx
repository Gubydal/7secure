import Link from "next/link";
import { formatDate } from "../lib/utils";
import { CategoryBadge } from "./CategoryBadge";
import type { ArticleRecord } from "../lib/supabase";

interface ArticleCardProps {
  article: Pick<
    ArticleRecord,
    "slug" | "title" | "summary" | "category" | "published_at" | "source_name" | "image_url"
  >;
  compact?: boolean;
}

export function ArticleCard({ article, compact = false }: ArticleCardProps) {
  const hasImage = Boolean(article.image_url);

  return (
    <article className={`article-card ${compact ? "article-card--compact" : ""}`.trim()}>
      <Link href={`/articles/${article.slug}`} className="article-card-media" aria-label={article.title}>
        {hasImage ? (
          <img src={article.image_url || ""} alt={article.title} loading="lazy" />
        ) : (
          <div className={`article-card-media-fallback tone-${article.category.replace(/-/g, "-")}`}>
            <span>{article.category.replace(/-/g, " ")}</span>
          </div>
        )}
      </Link>
      <div className="article-card-body">
        <CategoryBadge category={article.category} />
        <h3>
          <Link href={`/articles/${article.slug}`}>{article.title}</Link>
        </h3>
        {!compact ? <p>{article.summary}</p> : null}
        <div className="article-meta-row">
          <div className="article-meta">{formatDate(article.published_at)}</div>
          {article.source_name ? <div className="article-source">{article.source_name}</div> : null}
        </div>
      </div>
    </article>
  );
}
