import type { NewsletterArticle, RawFeedItem, WorkerEnv } from "../types";

const SYSTEM_PROMPT = `You are a cybersecurity journalist for 7secure, a professional daily newsletter.
Rewrite the given RSS item as a polished newsletter article.

Rules:
- Title: Punchy, specific, under 80 chars. No clickbait.
- Summary: 2 sentences, under 180 chars. Email preview text quality.
- Content: 500-700 words, written in clean markdown.
- Content structure: start with a short lead paragraph, then use headings in this order:
  ## Overview
  ## Technical details
  ## Why it matters
  ## What to do next
- Keep paragraphs short and easy to scan. Use bullets for actions when useful.
- Do not repeat the title as a top-level heading inside the body. The page already renders the title.
- Tags: 3-5 lowercase tags.
- Category: threat-intel | vulnerabilities | industry-news | research | ai-security | government
- Slug: URL-safe, lowercase, hyphens only.
- image_url: use the source image if available, otherwise use /cover.avif.

Return ONLY valid JSON:
{
  'title': '...', 'slug': '...', 'summary': '...', 'content': '...',
  'category': '...', 'tags': ['...'], 'source_name': '...', 'source_url': '...',
  'original_url': '...', 'image_url': '...'
}`;

const DEFAULT_COVER_IMAGE = "/cover.avif";

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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const splitSentences = (value: string): string[] => {
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.map((sentence) => normalizeWhitespace(sentence)).filter(Boolean);
};

const stripLeadingHeading = (content: string, title: string): string => {
  const normalizedContent = content.replace(/^\uFEFF/, "").trim();
  const titlePattern = new RegExp(`^#{1,3}\\s+${escapeRegExp(title)}\\s*(?:\\r?\\n)+`, "i");
  return normalizedContent.replace(titlePattern, "").trim();
};

const buildStructuredContent = (
  summary: string,
  body: string,
  item: RawFeedItem
): string => {
  const lead = splitSentences(summary).slice(0, 2).join(" ") || normalizeWhitespace(summary);
  const detail = normalizeWhitespace(body) || lead;
  const topicLabel = item.category.replace(/-/g, " ");

  return [
    lead,
    "## Overview",
    lead,
    "## Technical details",
    detail,
    "## Why it matters",
    `This matters because teams tracking ${topicLabel} need enough context to decide whether to patch, monitor, escalate, or brief stakeholders.`,
    "## What to do next",
    [
      `- Review the original report from [${item.sourceName}](${item.sourceUrl}).`,
      "- Check whether any of your assets or services are exposed to the same class of issue.",
      "- Share the update with response, engineering, and communications teams if action is required."
    ].join("\n"),
    "## Source",
    `Read the original report from [${item.sourceName}](${item.sourceUrl}).`
  ].join("\n\n");
};

const normalizeGeneratedContent = (
  title: string,
  summary: string,
  content: string,
  item: RawFeedItem
): string => {
  const cleanedContent = stripLeadingHeading(content, title);
  if (!cleanedContent) {
    return buildStructuredContent(summary, summary, item);
  }

  const hasStructuredHeadings = /^##\s+/m.test(cleanedContent);
  if (hasStructuredHeadings) {
    return [normalizeWhitespace(summary), cleanedContent].join("\n\n");
  }

  return buildStructuredContent(summary, cleanedContent, item);
};

const fallbackArticle = (item: RawFeedItem): NewsletterArticle => {
  const baseSlug = slugify(item.title) || "security-update";
  const uniqueSlug = `${baseSlug}-${hashString(item.url).slice(0, 6)}`;
  const summary = item.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const content = buildStructuredContent(summary, summary, item);

  return {
    title: item.title,
    slug: uniqueSlug,
    summary: summary.length > 220 ? `${summary.slice(0, 217)}...` : summary,
    content,
    category: item.category,
    tags: [item.category, "daily-brief", "rss"],
    source_name: item.sourceName,
    source_url: item.sourceUrl,
    original_url: item.url,
    image_url: item.imageUrl || DEFAULT_COVER_IMAGE,
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

    const finalTitle = parsed.title || item.title;
    const finalSummary = normalizeWhitespace(parsed.summary || item.summary);
    const finalContent = normalizeGeneratedContent(
      finalTitle,
      finalSummary,
      parsed.content,
      item
    );

    // Default to the original item's metadata if the LLM hallucinated or forgot to include it
    return {
      ...parsed,
      title: finalTitle,
      summary: finalSummary,
      content: finalContent,
      category: allowedCategories.has(parsed.category) ? parsed.category : item.category,
      source_name: parsed.source_name || item.sourceName || "Unknown Source",
      source_url: parsed.source_url || item.sourceUrl || "https://example.com",
      original_url: parsed.original_url || item.url || "https://example.com",
      image_url: parsed.image_url || item.imageUrl || DEFAULT_COVER_IMAGE
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
