export type ArticleCategory = string;

export interface RSSSource {
  name: string;
  url: string;
  category: ArticleCategory;
}

export interface RawFeedItem {
  title: string;
  url: string;
  summary: string;
  sourceSnippet?: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  category: ArticleCategory;
  imageUrl?: string | null;
}

export interface NewsletterArticle {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: ArticleCategory;
  tags: string[];
  source_name: string;
  source_url: string;
  original_url: string;
  image_url?: string | null;
  is_featured?: boolean;
  is_incident?: boolean;
  sufficient_data?: boolean;
}

export interface ArticleSnippet {
  title: string;
  slug: string;
  hook: string;
}

export interface DailyBriefing {
  id?: string;
  briefing_date: string;
  newsletter_title: string;
  snippets: ArticleSnippet[];
  article_slugs: string[];
}

export interface WorkerEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  LLM_API_KEY: string;
  LLM_BASE_URL: string;
  LLM_MODEL: string;
  BRAVE_SEARCH_API_KEY?: string;
  BRAVE_SEARCH_COUNTRY?: string;
  BRAVE_SEARCH_LANG?: string;
  BRAVE_SEARCH_RESULTS_PER_QUERY?: string;
  BRAVE_SEARCH_FRESHNESS?: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  RESEND_AUDIENCE_ID: string;
  WORKER_SECRET: string;
  NEXT_PUBLIC_SITE_URL: string;
}
