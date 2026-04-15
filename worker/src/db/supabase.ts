import { createClient } from "@supabase/supabase-js";
import type { NewsletterArticle, WorkerEnv } from "../types";

interface Subscriber {
  id: string;
  email: string;
}

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
    is_featured: index === 0
  }));

  await getSupabaseAdmin(env)
    .from("articles")
    .upsert(payload, { onConflict: "slug", ignoreDuplicates: true });
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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await getSupabaseAdmin(env)
    .from("articles")
    .select("title,slug,summary,category,published_at")
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  return data ?? [];
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
