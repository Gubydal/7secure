import { cleanItems } from "../worker/src/bridge/cleaner";
import { writeArticles } from "../worker/src/bridge/writer";
import { fetchFeeds } from "../worker/src/rss/fetcher";
import type { WorkerEnv } from "../worker/src/types";

const envMap: Record<string, string | undefined> =
  ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
    {}) as Record<string, string | undefined>;

const buildWorkerEnv = (): WorkerEnv => {
  const braveApiKey = envMap.BRAVE_SEARCH_API_KEY || "";
  if (!braveApiKey) {
    throw new Error("Missing BRAVE_SEARCH_API_KEY for preview run");
  }

  return {
    SUPABASE_URL: envMap.SUPABASE_URL || "https://placeholder.supabase.co",
    SUPABASE_SERVICE_KEY: envMap.SUPABASE_SERVICE_KEY || "placeholder",
    LLM_API_KEY: envMap.LLM_API_KEY || "missing-llm-key",
    LLM_BASE_URL: envMap.LLM_BASE_URL || "https://api.longcat.chat/openai/v1",
    LLM_MODEL: envMap.LLM_MODEL || "LongCat-Flash-Thinking-2601",
    BRAVE_SEARCH_API_KEY: braveApiKey,
    BRAVE_SEARCH_COUNTRY: envMap.BRAVE_SEARCH_COUNTRY || "us",
    BRAVE_SEARCH_LANG: envMap.BRAVE_SEARCH_LANG || "en",
    BRAVE_SEARCH_RESULTS_PER_QUERY: envMap.BRAVE_SEARCH_RESULTS_PER_QUERY || "8",
    BRAVE_SEARCH_FRESHNESS: envMap.BRAVE_SEARCH_FRESHNESS || "pw",
    RESEND_API_KEY: envMap.RESEND_API_KEY || "placeholder",
    RESEND_FROM_EMAIL: envMap.RESEND_FROM_EMAIL || "7secure <onboarding@resend.dev>",
    RESEND_AUDIENCE_ID: envMap.RESEND_AUDIENCE_ID || "placeholder",
    WORKER_SECRET: envMap.WORKER_SECRET || "preview",
    NEXT_PUBLIC_SITE_URL: envMap.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev"
  };
};

const run = async () => {
  const env = buildWorkerEnv();

  console.log("Step 1: Fetching Brave news results");
  const raw = await fetchFeeds(env);
  console.log(`Fetched ${raw.length} raw Brave results`);

  if (!raw.length) {
    console.log("No Brave results returned.");
    return;
  }

  console.log("Step 2: Cleaning and ranking candidates");
  const cleaned = cleanItems(raw);
  console.log(`Cleaned to ${cleaned.length} candidates`);

  const selected = cleaned.slice(0, 3);
  console.log(
    "Selected items:",
    JSON.stringify(
      selected.map((item) => ({
        title: item.title,
        source: item.sourceName,
        category: item.category,
        url: item.url,
        image: item.imageUrl || null
      })),
      null,
      2
    )
  );

  console.log("Step 3: Generating article drafts");
  const categoryPool = [...new Set(cleaned.map((item) => item.category))].slice(0, 10);
  const articles = await writeArticles(selected, env, categoryPool);

  console.log(`Generated ${articles.length} article draft(s)`);

  const previews = articles.map((article, index) => ({
    rank: index + 1,
    title: article.title,
    slug: article.slug,
    category: article.category,
    tags: article.tags,
    source_url: article.source_url,
    original_url: article.original_url,
    image_url: article.image_url,
    summary: article.summary,
    content_preview: article.content.slice(0, 700)
  }));

  console.log("Article previews:");
  console.log(JSON.stringify(previews, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
