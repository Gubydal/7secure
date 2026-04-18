import type { NewsletterArticle, RawFeedItem, WorkerEnv } from "../types";

const SYSTEM_PROMPT = `You are a cybersecurity journalist for 7secure.
Rewrite the provided feed item into a publication-ready analysis article.

Hard requirements:
- Title: specific, under 80 chars, no clickbait.
- Summary: 2 concise sentences explaining why readers should care (this is rendered as "Why this matters").
- Content: 650-950 words in clean markdown.
- Content must NOT repeat the summary verbatim.
- Content must NOT repeat the title as an H1/H2.
- Use 4-6 descriptive H2 sections with unique headings.
- Include one short, practical bullet list.
- Keep paragraphs short and scannable.
- Use only facts present in the input. If unknown, write that it was not disclosed.
- Do not include website/source name in author voice.
- Tags: 3-5 lowercase tags.
- Category: threat-intel | vulnerabilities | industry-news | research | ai-security | government.
- Slug: lowercase URL-safe with hyphens.
- image_url: use source image if available, otherwise /cover.avif.

Input fields:
- summary: short feed summary text.
- source_snippet: richer extracted text from the feed/article body.

Return ONLY valid JSON:
{
  'title': '...', 'slug': '...', 'summary': '...', 'content': '...',
  'category': '...', 'tags': ['...'], 'source_name': '7secure', 'source_url': '...',
  'original_url': '...', 'image_url': '...'
}`;

const DEFAULT_COVER_IMAGE = "/cover.avif";
const LLM_TIMEOUT_MS = 75_000;

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

const normalizeForCompare = (value: string): string =>
  value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenSimilarity = (a: string, b: string): number => {
  const aTokens = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeForCompare(b).split(" ").filter(Boolean));

  if (!aTokens.size || !bTokens.size) {
    return 0;
  }

  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
};

const truncateSummary = (value: string): string =>
  value.length > 220 ? `${value.slice(0, 217)}...` : value;

const dedupeOpeningSummary = (summary: string, content: string): string => {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (!blocks.length) {
    return content;
  }

  const cleaned: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const plainBlock = block.replace(/^#{1,6}\s+/, "").trim();

    if (index === 0 && tokenSimilarity(summary, plainBlock) >= 0.7) {
      continue;
    }

    if (cleaned.length > 0) {
      const previous = cleaned[cleaned.length - 1].replace(/^#{1,6}\s+/, "").trim();
      if (tokenSimilarity(previous, plainBlock) >= 0.95) {
        continue;
      }
    }

    cleaned.push(block);
  }

  return cleaned.join("\n\n").trim();
};

const buildStructuredContent = (
  summary: string,
  body: string,
  item: RawFeedItem
): string => {
  const cleanedSummary = normalizeWhitespace(summary) || "Security teams should review this update for potential operational impact.";
  const sourceBase = normalizeWhitespace(body || item.sourceSnippet || cleanedSummary);
  const sourceSentences = splitSentences(sourceBase);

  const overview =
    sourceSentences.slice(0, 6).join(" ") ||
    sourceBase ||
    "The source described a security update, but complete technical details were not disclosed.";

  const technicalDetails =
    sourceSentences.slice(6, 14).join(" ") ||
    "Technical specifics remain limited in the available source text, so teams should validate exposure against their own environment and controls.";

  const operationalImpact =
    sourceSentences.slice(14, 22).join(" ") ||
    "Operationally, this requires a rapid assessment of affected systems, communications to owners, and verification that existing detections still cover the described behavior.";

  const topicLabel = item.category.replace(/-/g, " ");
  const [firstHeading, secondHeading, thirdHeading] = pickFallbackHeadings(item);

  return [
    `## ${firstHeading}`,
    overview,
    `## ${secondHeading}`,
    technicalDetails,
    `## ${thirdHeading}`,
    operationalImpact,
    "## What teams should do now",
    [
      "- Confirm whether any production systems match the affected technology or behavior.",
      "- Validate logging, alerting, and detection coverage tied to this class of threat.",
      "- Coordinate with incident response and infrastructure owners on prioritization.",
      `- Brief leadership on potential impact to ${topicLabel} posture and immediate mitigations.`
    ].join("\n"),
    "## Source",
    `Original reporting: [Open source article](${item.url}).`,
    "Some implementation-specific details were not disclosed in the source material."
  ].join("\n\n");
};

const normalizeGeneratedContent = (
  title: string,
  summary: string,
  content: string,
  item: RawFeedItem
): string => {
  const cleanedContent = dedupeOpeningSummary(summary, stripLeadingHeading(content, title));
  if (!cleanedContent) {
    return buildStructuredContent(summary, item.sourceSnippet || summary, item);
  }

  const headingCount = (cleanedContent.match(/^##\s+/gm) || []).length;
  if (headingCount >= 3 && cleanedContent.length >= 1200) {
    return cleanedContent;
  }

  return buildStructuredContent(summary, [item.sourceSnippet || "", cleanedContent].join("\n\n"), item);
};

const fallbackArticle = (item: RawFeedItem): NewsletterArticle => {
  const baseSlug = slugify(item.title) || "security-update";
  const uniqueSlug = `${baseSlug}-${hashString(item.url).slice(0, 6)}`;
  const cleanedSummary = item.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const summary =
    cleanedSummary ||
    `Security teams should review this update relevant to ${item.category.replace(/-/g, " ")}.`;
  const content = buildStructuredContent(summary, item.sourceSnippet || summary, item);

  return {
    title: item.title,
    slug: uniqueSlug,
    summary: truncateSummary(summary),
    content,
    category: item.category,
    tags: [item.category, "daily-brief", "rss"],
    source_name: "7secure",
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
            content: JSON.stringify({
              title: item.title,
              url: item.url,
              summary: item.summary,
              source_snippet: item.sourceSnippet || "",
              published_at: item.publishedAt,
              source_name: item.sourceName,
              source_url: item.sourceUrl,
              category: item.category,
              image_url: item.imageUrl || DEFAULT_COVER_IMAGE
            })
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
    const finalSummary = truncateSummary(normalizeWhitespace(parsed.summary || item.summary));
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
      source_name: "7secure",
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
  const candidates = items.slice(0, 8);
  const results: NewsletterArticle[] = [];
  const concurrency = 3;

  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const settled = await Promise.allSettled(chunk.map((item) => rewriteItem(item, env)));

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
};
