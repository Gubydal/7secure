import type { NewsletterArticle, RawFeedItem, WorkerEnv } from "../types";

const SYSTEM_PROMPT = `You are a cybersecurity journalist for 7secure, a professional daily newsletter.
Rewrite the given RSS item as a polished newsletter article.

Rules:
- Title: Punchy, specific, under 80 chars. No clickbait.
- Summary: 2 sentences, under 150 chars. Email preview text quality.
- Content: 3-4 paragraphs. Informative, neutral, professional. Include technical details.
  End with a 'Why it matters' paragraph.
- Tags: 3-5 lowercase tags.
- Category: threat-intel | vulnerabilities | industry-news | research | ai-security | government
- Slug: URL-safe, lowercase, hyphens only.

Return ONLY valid JSON:
{
  'title': '...', 'slug': '...', 'summary': '...', 'content': '...',
  'category': '...', 'tags': ['...'], 'source_name': '...', 'source_url': '...',
  'original_url': '...'
}`;

const allowedCategories = new Set([
  "threat-intel",
  "vulnerabilities",
  "industry-news",
  "research",
  "ai-security",
  "government"
]);

const extractJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const isValidArticle = (article: any): article is NewsletterArticle => {
  return (
    typeof article?.title === "string" &&
    article.title.length > 0 &&
    article.title.length <= 80 &&
    typeof article?.slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) &&
    typeof article?.summary === "string" &&
    article.summary.length > 0 &&
    article.summary.length <= 150 &&
    typeof article?.content === "string" &&
    article.content.length > 0 &&
    typeof article?.category === "string" &&
    allowedCategories.has(article.category) &&
    Array.isArray(article?.tags) &&
    article.tags.length >= 3 &&
    article.tags.length <= 5 &&
    article.tags.every((tag: unknown) => typeof tag === "string") &&
    typeof article?.source_name === "string" &&
    typeof article?.source_url === "string" &&
    typeof article?.original_url === "string"
  );
};

const rewriteItem = async (
  item: RawFeedItem,
  env: WorkerEnv
): Promise<NewsletterArticle | null> => {
  try {
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: JSON.stringify(item)
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("LongCat API Error:", response.status, await response.text());
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = extractJson(content);
    if (!isValidArticle(parsed)) {
      return null;
    }

    return {
      ...parsed,
      source_name: parsed.source_name || item.sourceName,
      source_url: parsed.source_url || item.sourceUrl,
      original_url: parsed.original_url || item.url
    };
  } catch (error) {
    console.error(`LLM Rewrite Error (${item.title}):`, (error as Error).message);
    return null;
  }
};

export const writeArticles = async (
  items: RawFeedItem[],
  env: WorkerEnv
): Promise<NewsletterArticle[]> => {
  // Only process top 5 to keep LLM calls fast and under Cloudflare's subrequest limit
  const settled = await Promise.allSettled(items.slice(0, 5).map((item) => rewriteItem(item, env)));

  return settled
    .filter((result): result is PromiseFulfilledResult<NewsletterArticle | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((article): article is NewsletterArticle => article !== null);
};
