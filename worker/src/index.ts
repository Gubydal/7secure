import { cleanItems } from "./bridge/cleaner";
import { generateNewsletterTitle } from "./bridge/title-generator";
import { generateSnippetOfTheWeek } from "./bridge/snippet-generator";
import { writeArticles } from "./bridge/writer";
import { logDigest, saveArticles, getExistingUrls, getTrackedCategories, saveDailyBriefing } from "./db/supabase";
import { sendDigest } from "./email/digest";
import { fetchFeeds } from "./rss/fetcher";
import type { WorkerEnv } from "./types";

export const runDailyPipeline = async (env: WorkerEnv): Promise<void> => {
  try {
    console.log("Starting daily pipeline...");
    const raw = await fetchFeeds(env);
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
      const trackedCategories = await getTrackedCategories(env, 10);
      preparedArticles = await writeArticles(newItems, env, trackedCategories);
      console.log(`Prepared ${preparedArticles.length} articles for Supabase`);

      if (preparedArticles.length > 0) {
        await saveArticles(env, preparedArticles);
        console.log("Saved articles to Supabase");
      }
    }

    // Generate AI newsletter title and snippet hooks from prepared articles
    let newsletterTitle = "Daily Security Intelligence Brief";
    let snippets: Awaited<ReturnType<typeof generateSnippetOfTheWeek>> = [];

    if (preparedArticles.length > 0) {
      const [generatedTitle, generatedSnippets] = await Promise.all([
        generateNewsletterTitle(
          preparedArticles.map((a) => ({ title: a.title, summary: a.summary, category: a.category })),
          env
        ),
        generateSnippetOfTheWeek(
          preparedArticles.map((a) => ({ title: a.title, slug: a.slug, summary: a.summary })),
          env
        )
      ]);
      newsletterTitle = generatedTitle;
      snippets = generatedSnippets;

      await saveDailyBriefing(env, {
        newsletter_title: newsletterTitle,
        snippets,
        article_slugs: preparedArticles.map((a) => a.slug)
      });
    }

    const digestResult = await sendDigest(env, newsletterTitle, snippets);
    if (digestResult.status === "success") {
      console.log(
        `Digest accepted by Resend for ${digestResult.subscriberCount} subscribers using ${digestResult.articleCount} articles`
      );
    } else {
      console.error(
        `Digest send encountered failures. Subscribers=${digestResult.subscriberCount}, Articles=${digestResult.articleCount}`
      );
    }

    await logDigest(
      env,
      digestResult.articleCount,
      digestResult.subscriberCount,
      digestResult.status
    );

    if (digestResult.status === "failed") {
      throw new Error("Digest delivery failed. Check Resend sender/domain settings and worker logs.");
    }

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
