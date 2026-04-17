import { cleanItems } from "./bridge/cleaner";
import { writeArticles } from "./bridge/writer";
import { logDigest, saveArticles, getExistingUrls } from "./db/supabase";
import { sendDigest } from "./email/digest";
import { fetchFeeds } from "./rss/fetcher";
import type { WorkerEnv } from "./types";

export const runDailyPipeline = async (env: WorkerEnv): Promise<void> => {
  try {
    console.log("Starting daily pipeline...");
    const raw = await fetchFeeds();
    console.log(`Fetched ${raw.length} raw items`);
    const cleaned = cleanItems(raw);
    console.log(`Cleaned down to ${cleaned.length} items`);
    
    // De-duplicate against the database using original_url to prevent LLM from rewriting yesterday's articles over and over again
    const allUrls = cleaned.map(item => item.url);
    const existingUrlSet = await getExistingUrls(env, allUrls);
    const newItems = cleaned.filter(item => !existingUrlSet.has(item.url));
    console.log(`Found ${newItems.length} truly NEW articles`);

    let preparedArticles: Awaited<ReturnType<typeof writeArticles>> = [];

    if (newItems.length === 0) {
      console.log("No brand-new articles found. Sending digest from recent stored articles.");
    } else {
      preparedArticles = await writeArticles(newItems, env);
      console.log(`Prepared ${preparedArticles.length} articles for Supabase`);

      if (preparedArticles.length > 0) {
        await saveArticles(env, preparedArticles);
        console.log("Saved articles to Supabase");
      }
    }

    const digestResult = await sendDigest(env);
    console.log("Sent newsletter digests via Resend");
    await logDigest(
      env,
      digestResult.articleCount,
      digestResult.subscriberCount,
      digestResult.status
    );
    console.log("Pipeline finished successfully!");
  } catch (error) {
    console.error("FATAL ERROR IN PIPELINE:", (error as Error).message);
    throw error;
  }
};

const unauthorized = () =>
  new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });

const isAuthorized = (request: Request, env: WorkerEnv): boolean => {
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${env.WORKER_SECRET}`;
  return auth === expected;
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return unauthorized();
      }

      await runDailyPipeline(env);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("7secure worker is running", { status: 200 });
  },

  async scheduled(
    _event: ScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    await runDailyPipeline(env);
  }
};
