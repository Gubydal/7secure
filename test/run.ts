import { parseFeedXml } from "../worker/src/rss/parser";
import { writeArticles } from "../worker/src/bridge/writer";
import { saveArticles } from "../worker/src/db/supabase";
import { sendDigest } from "../worker/src/email/digest";
import type { WorkerEnv } from "../worker/src/types";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_AUDIENCE_ID",
  "NEXT_PUBLIC_SITE_URL",
  "TEST_EMAIL"
] as const;

const envMap: Record<string, string | undefined> =
  ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
    {}) as Record<string, string | undefined>;

const getEnv = (): WorkerEnv & { TEST_EMAIL: string } => {
  const missing = required.filter((key) => !envMap[key]);
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  return {
    SUPABASE_URL: envMap.SUPABASE_URL as string,
    SUPABASE_SERVICE_KEY: envMap.SUPABASE_SERVICE_KEY as string,
    LLM_API_KEY: envMap.LLM_API_KEY as string,
    LLM_BASE_URL: envMap.LLM_BASE_URL as string,
    LLM_MODEL: envMap.LLM_MODEL as string,
    RESEND_API_KEY: envMap.RESEND_API_KEY as string,
    RESEND_FROM_EMAIL: envMap.RESEND_FROM_EMAIL as string,
    RESEND_AUDIENCE_ID: envMap.RESEND_AUDIENCE_ID as string,
    WORKER_SECRET: envMap.WORKER_SECRET || "test-secret",
    NEXT_PUBLIC_SITE_URL: envMap.NEXT_PUBLIC_SITE_URL as string,
    TEST_EMAIL: envMap.TEST_EMAIL as string
  };
};

const targetedFeeds = [
  {
    name: "CISA Alerts",
    url: "https://www.cisa.gov/uscert/ncas/alerts.xml",
    category: "government" as const
  },
  {
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    category: "industry-news" as const
  },
  {
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/rss/",
    category: "industry-news" as const
  }
];

const run = async () => {
  const env = getEnv();

  console.log("Step 1: Fetch and parse 3 feeds");
  const all = await Promise.all(
    targetedFeeds.map(async (source) => {
      const response = await fetch(source.url);
      const xml = await response.text();
      const items = parseFeedXml(xml, source);
      return { source: source.name, items: items.slice(0, 3) };
    })
  );

  for (const feed of all) {
    console.log(`\\nFeed: ${feed.source}`);
    console.log(feed.items.map((item) => ({ title: item.title, url: item.url })));
  }

  const oneItem = all.flatMap((f) => f.items)[0];
  if (!oneItem) {
    throw new Error("No test item found from target feeds.");
  }

  console.log("\\nStep 2: Send one item through AI bridge");
  const written = await writeArticles([oneItem], env);
  if (!written.length) {
    throw new Error("Writer returned no article.");
  }
  console.log(written[0]);

  console.log("\\nStep 3: Save test article to Supabase");
  await saveArticles(env, written);
  console.log("Saved test article.");

  console.log("\\nStep 4: Send test digest via Resend");
  await sendDigest({ ...env, NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL });
  console.log(`Digest sent. Ensure TEST_EMAIL (${env.TEST_EMAIL}) is subscribed in Supabase.`);
};

run().catch((error) => {
  console.error(error);
  throw error;
});
