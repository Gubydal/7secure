import { cleanItems } from "./bridge/cleaner";
import { writeArticles } from "./bridge/writer";
import { logDigest, saveArticles } from "./db/supabase";
import { sendDigest } from "./email/digest";
import { fetchFeeds } from "./rss/fetcher";
import type { WorkerEnv } from "./types";

export const runDailyPipeline = async (env: WorkerEnv): Promise<void> => {
  const raw = await fetchFeeds();
  const cleaned = cleanItems(raw);
  const rewritten = await writeArticles(cleaned, env);
  await saveArticles(env, rewritten);
  const digestResult = await sendDigest(env);
  await logDigest(
    env,
    digestResult.articleCount,
    digestResult.subscriberCount,
    digestResult.status
  );
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
    ctx.waitUntil(runDailyPipeline(env));
  }
};
