import type { NewsletterArticle, RawFeedItem, WorkerEnv } from "../types";

const SYSTEM_PROMPT = `You are a cybersecurity journalist for 7secure, a professional daily newsletter.
Rewrite the given RSS item as a polished newsletter article.

Rules:
- Title: Punchy, specific, under 80 chars. No clickbait.
- Summary: 2 sentences, under 180 chars. Email preview text quality.
- Content: 500-750 words, written in clean markdown.
- Start with a short lead paragraph, then use 3-5 descriptive H2 headings.
- Headings must be relevant to this story and should vary between articles.
- Include at least one short bullet list of concrete actions.
- Keep paragraphs short and easy to scan.
- Do not repeat the title as a top-level heading inside the body. The page already renders the title.
- Use ONLY facts present in the provided item. Do not invent CVEs, actor names, product versions, or impact numbers.
- If something is missing, say it was not disclosed by the source.
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
const LLM_TIMEOUT_MS = 40_000;

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

const headingPools: Record<string, string[]> = {
  "threat-intel": [
    "Attack chain and observed behavior",
    "What defenders should monitor",
    "Exposure and likely impact",
    "Signals worth tracking this week",
    "How this campaign is evolving"
  ],
  vulnerabilities: [
    "Where the weakness appears",
    "Technical risk and exploitability",
    "Patch and mitigation priorities",
    "Operational impact for security teams",
    "Validation steps after remediation"
  ],
  "industry-news": [
    "What happened",
    "Technical context behind the update",
    "Why this matters for teams",
    "Immediate next actions",
    "Questions security leaders should ask"
  ],
  research: [
    "Research focus",
    "Methodology and key observations",
    "Practical implications",
    "How to apply this in production",
    "Limitations and open questions"
  ],
  "ai-security": [
    "Model and threat context",
    "Observed failure modes",
    "Defensive controls to prioritize",
    "Risk trade-offs for adoption",
    "What to test next"
  ],
  government: [
    "Advisory summary",
    "Who should act first",
    "Recommended mitigations",
    "Coordination and reporting guidance",
    "Compliance and response planning"
  ]
};

const pickFallbackHeadings = (item: RawFeedItem): [string, string, string] => {
  const pool = headingPools[item.category] || headingPools["industry-news"];
  const seed = parseInt(hashString(item.url).slice(0, 6), 36) || 0;

  const first = pool[seed % pool.length];
  const second = pool[(seed + 2) % pool.length];
  const third = pool[(seed + 4) % pool.length];

  return [first, second, third];
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
  const cleanedSummary = normalizeWhitespace(summary) || `${item.sourceName} reported a new security update.`;
  const lead = splitSentences(cleanedSummary).slice(0, 2).join(" ") || cleanedSummary;
  const detail = normalizeWhitespace(body) || cleanedSummary;
  const topicLabel = item.category.replace(/-/g, " ");
  const [firstHeading, secondHeading, thirdHeading] = pickFallbackHeadings(item);

  return [
    lead,
    `## ${firstHeading}`,
    detail,
    `## ${secondHeading}`,
    `This matters because teams tracking ${topicLabel} need enough context to decide whether to patch, monitor, escalate, or brief stakeholders.`,
    `## ${thirdHeading}`,
    [
      `- Review the original report from [${item.sourceName}](${item.sourceUrl}).`,
      "- Check whether any of your assets or services are exposed to the same class of issue.",
      "- Verify detections and logging coverage before and after mitigation.",
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
  const lead = splitSentences(summary).slice(0, 2).join(" ") || normalizeWhitespace(summary);

  if (hasStructuredHeadings) {
    const contentWithLead = cleanedContent.startsWith(lead)
      ? cleanedContent
      : [lead, cleanedContent].join("\n\n");

    if (contentWithLead.length < 700) {
      return buildStructuredContent(summary, contentWithLead, item);
    }

    return contentWithLead;
  }

  return buildStructuredContent(summary, cleanedContent, item);
};

const fallbackArticle = (item: RawFeedItem): NewsletterArticle => {
  const baseSlug = slugify(item.title) || "security-update";
  const uniqueSlug = `${baseSlug}-${hashString(item.url).slice(0, 6)}`;
  const cleanedSummary = item.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const summary = cleanedSummary || `${item.sourceName} published a cybersecurity update relevant to ${item.category.replace(/-/g, " ")}.`;
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
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    console.log(`Sending to LLM: ${item.title.substring(0, 30)}...`);
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
      console.error("LLM API Error:", response.status, await response.text());
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
      console.error(`LLM rewrite timeout after ${Math.round(LLM_TIMEOUT_MS / 1000)}s for: ${item.title.substring(0, 30)}...`);
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
  // Process a larger batch to keep the daily feed fresh while staying within worker limits.
  const settled = await Promise.allSettled(items.slice(0, 8).map((item) => rewriteItem(item, env)));

  return settled
    .filter((result): result is PromiseFulfilledResult<NewsletterArticle | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((article): article is NewsletterArticle => article !== null);
};
