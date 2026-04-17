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
- image_url: optional canonical thumbnail URL if the source provided one.

Return ONLY valid JSON:
{
  'title': '...', 'slug': '...', 'summary': '...', 'content': '...',
  'category': '...', 'tags': ['...'], 'source_name': '...', 'source_url': '...',
  'original_url': '...', 'image_url': '...'
}`;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const fallbackArticle = (item: RawFeedItem): NewsletterArticle => {
  const baseSlug = slugify(item.title) || "security-update";
  const uniqueSlug = `${baseSlug}-${hashString(item.url).slice(0, 6)}`;
  const summary = item.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return {
    title: item.title,
    slug: uniqueSlug,
    summary: summary.length > 220 ? `${summary.slice(0, 217)}...` : summary,
    content: `# ${item.title}\n\n${summary}\n\n## Why it matters\n\nThis item was automatically captured from ${item.sourceName} while the rewrite service was unavailable. You can still use it as a live update in the daily briefing.\n\nSource: [${item.sourceName}](${item.sourceUrl})`,
    category: item.category,
    tags: [item.category, "daily-brief", "rss"],
    source_name: item.sourceName,
    source_url: item.sourceUrl,
    original_url: item.url,
    image_url: item.imageUrl || null,
    is_featured: false
  };
};

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
  if (!article) return false;
  const isOk = (
    typeof article?.title === "string" &&
    article.title.length > 0 &&
    typeof article?.slug === "string" &&
    typeof article?.summary === "string" &&
    article.summary.length > 0 &&
    typeof article?.content === "string" &&
    article.content.length > 0 &&
    typeof article?.category === "string" &&
    Array.isArray(article?.tags)
  );
  if (!isOk) {
    console.error("Article validation failed. Parsed:", article);
  }
  return isOk;
};

const rewriteItem = async (
  item: RawFeedItem,
  env: WorkerEnv
): Promise<NewsletterArticle | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds max

  try {
    console.log(`Sending to LongCat: ${item.title.substring(0, 30)}...`);
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
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
      return fallbackArticle(item);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content from LLM");
      return fallbackArticle(item);
    }

    const parsed = extractJson(content) as any;
    if (!isValidArticle(parsed)) {
      return fallbackArticle(item);
    }

    // Default to the original item's metadata if the LLM hallucinated or forgot to include it
    return {
      ...parsed,
      category: allowedCategories.has(parsed.category) ? parsed.category : "industry-news",
      source_name: parsed.source_name || item.sourceName || "Unknown Source",
      source_url: parsed.source_url || item.sourceUrl || "https://example.com",
      original_url: parsed.original_url || item.url || "https://example.com",
      image_url: parsed.image_url || item.imageUrl || null
    } as NewsletterArticle;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error(`LLM Rewrite Timeout after 12s for: ${item.title.substring(0, 30)}...`);
    } else {
      console.error(`LLM Rewrite Error (${item.title}):`, (error as Error).message);
    }
    return fallbackArticle(item);
  } finally {
    clearTimeout(timeoutId);
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
