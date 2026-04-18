import { createClient } from "@supabase/supabase-js";
import type { NewsletterArticle, WorkerEnv } from "../types";

interface Subscriber {
  id: string;
  email: string;
}

export const getExistingUrls = async (env: WorkerEnv, urls: string[]): Promise<Set<string>> => {
  if (!urls.length) return new Set();
  
  const { data } = await getSupabaseAdmin(env)
    .from("articles")
    .select("original_url")
    .in("original_url", urls);

  return new Set((data || []).map(row => row.original_url));
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
    original_url: article.original_url,
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
    .select("id,email")
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
