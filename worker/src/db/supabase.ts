import { createClient } from "@supabase/supabase-js";
import type { NewsletterArticle, WorkerEnv } from "../types";

interface Subscriber {
  id: string;
  email: string;
  role?: string | null;
}

interface SentArticleRow {
  article_slug: string;
}

const normalizeArticleUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";

    const trackingKeys = [
      "gclid",
      "fbclid",
      "mc_cid",
      "mc_eid",
      "mkt_tok",
      "igshid",
      "ref",
      "ref_src"
    ];

    for (const key of [...url.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || trackingKeys.includes(lowerKey)) {
        url.searchParams.delete(key);
      }
    }

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return trimmed;
  }
};

export const getExistingUrls = async (env: WorkerEnv, urls: string[]): Promise<Set<string>> => {
  const candidateSet = new Set(urls.map((url) => normalizeArticleUrl(url)).filter(Boolean));
  if (!candidateSet.size) {
    return new Set();
  }

  const { data } = await getSupabaseAdmin(env)
    .from("articles")
    .select("original_url")
    .order("published_at", { ascending: false })
    .limit(4000);

  const existingMatching = new Set<string>();
  for (const row of data || []) {
    const normalized = normalizeArticleUrl(row.original_url || "");
    if (normalized && candidateSet.has(normalized)) {
      existingMatching.add(normalized);
    }
  }

  return existingMatching;
};

export const getSupabaseAdmin = (env: WorkerEnv) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

export const saveArticles = async (
  env: WorkerEnv,
  articles: NewsletterArticle[]
): Promise<void> => {
  if (!articles.length) {
    return;
  }

  const payload = articles.map((article, index) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    content: article.content,
    category: article.category,
    source_name: article.source_name,
    source_url: article.source_url,
    original_url: normalizeArticleUrl(article.original_url),
    image_url: article.image_url ?? null,
    tags: article.tags,
    is_featured: index === 0,
    published_at: new Date().toISOString()
  }));

  await getSupabaseAdmin(env)
    .from("articles")
    .upsert(payload, { onConflict: "slug" });
};

export const getSubscribers = async (env: WorkerEnv): Promise<Subscriber[]> => {
  const { data } = await getSupabaseAdmin(env)
    .from("subscribers")
    .select("id,email,role")
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  return data ?? [];
};

export const getRecentArticles = async (env: WorkerEnv) => {
  // Prefer recent records first; if empty, fall back to latest stored articles so the digest still sends.
  const since = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  const admin = getSupabaseAdmin(env);

  const { data } = await admin
    .from("articles")
    .select("title,slug,summary,content,category,published_at,image_url,original_url")
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if (data && data.length > 0) {
    return data;
  }

  const { data: fallback } = await admin
    .from("articles")
    .select("title,slug,summary,content,category,published_at,image_url,original_url")
    .order("published_at", { ascending: false })
    .limit(12);

  return fallback ?? [];
};

export const logDigest = async (
  env: WorkerEnv,
  articleCount: number,
  subscriberCount: number,
  status: "success" | "failed"
): Promise<void> => {
  await getSupabaseAdmin(env).from("digest_logs").insert({
    article_count: articleCount,
    subscriber_count: subscriberCount,
    status
  });
};

export const getSentArticleSlugs = async (
  env: WorkerEnv,
  slugs: string[]
): Promise<Set<string>> => {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!unique.length) {
    return new Set();
  }

  try {
    const { data, error } = await getSupabaseAdmin(env)
      .from("digest_sent_articles")
      .select("article_slug")
      .in("article_slug", unique);

    if (error) {
      console.error("digest_sent_articles lookup failed:", error.message);
      return new Set();
    }

    return new Set(((data as SentArticleRow[] | null) ?? []).map((row) => row.article_slug));
  } catch (error) {
    console.error("digest_sent_articles lookup error:", (error as Error).message);
    return new Set();
  }
};

export const markDigestArticlesSent = async (env: WorkerEnv, slugs: string[]): Promise<void> => {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!unique.length) {
    return;
  }

  try {
    const { error } = await getSupabaseAdmin(env)
      .from("digest_sent_articles")
      .upsert(
        unique.map((article_slug) => ({ article_slug, sent_at: new Date().toISOString() })),
        { onConflict: "article_slug" }
      );

    if (error) {
      console.error("digest_sent_articles upsert failed:", error.message);
    }
  } catch (error) {
    console.error("digest_sent_articles upsert error:", (error as Error).message);
  }
};
