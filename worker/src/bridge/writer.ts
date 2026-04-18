import type { NewsletterArticle, RawFeedItem, WorkerEnv } from "../types";

const SYSTEM_PROMPT = `You are a cybersecurity journalist for 7secure.
Rewrite the provided feed item into a publication-ready analysis article.

Hard requirements:
- Title: specific, catchy, and concrete. Keep it 45-72 chars. No clickbait or vague wording.
- Summary: 2 concise sentences explaining why readers should care (this is rendered as "Why this matters").
- Content: 620-900 words in clean markdown.
- Content must NOT repeat the summary verbatim.
- Content must NOT repeat the title as an H1/H2.
- Use 5-7 descriptive H2 sections with unique headings.
- Do not use emojis anywhere in title, summary, headings, or body.
- Include 1-2 practical bullet lists with concrete, actionable points.
- Keep paragraphs short and scannable.
- Avoid generic repeated headings such as "What happened" or "What teams should do now".
- Every heading must be specific to this article. No canned section titles reused across stories.
- Use a natural narrative flow: context, technical detail, team impact, response priorities, and open questions.
- Use only facts present in the input. If unknown, write that it was not disclosed.
- Do not include website/source name in author voice.
- Tags: 3-5 lowercase tags.
- Category: short kebab-case slug. Prefer categories from preferred_categories when possible.
- If a new category is truly needed, keep it concise (1-3 words, kebab-case).
- Slug: lowercase URL-safe with hyphens.
- image_url: use source image if available, otherwise /cover.avif.

Input fields:
- summary: short feed summary text.
- source_snippet: richer extracted text from the feed/article body.
- preferred_categories: existing categories in the system (max 10).

Return ONLY valid JSON:
{
  'title': '...', 'slug': '...', 'summary': '...', 'content': '...',
  'category': '...', 'tags': ['...'], 'source_name': '7secure', 'source_url': '...',
  'original_url': '...', 'image_url': '...'
}`;

const DEFAULT_COVER_IMAGE = "/cover.avif";
const LLM_TIMEOUT_MS = 105_000;
const DEFAULT_CATEGORY_POOL = [
  "industry-news",
  "threat-intel",
  "vulnerabilities",
  "ai-security",
  "research",
  "government"
];

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

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

const stripEmojiInline = (value: string): string =>
  normalizeWhitespace(value.replace(EMOJI_REGEX, " "));

const stripEmojiMarkdown = (value: string): string =>
  value
    .replace(EMOJI_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeCategorySlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

const splitSentences = (value: string): string[] => {
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.map((sentence) => normalizeWhitespace(sentence)).filter(Boolean);
};

const countWords = (value: string): number =>
  value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;

const headingPools: Record<string, string[]> = {
  "threat-intel": [
    "Campaign flow and observed behavior",
    "Detection signals defenders should track",
    "Exposure and likely blast radius",
    "Defensive moves to prioritize now",
    "How this threat may evolve next"
  ],
  vulnerabilities: [
    "Where the weakness appears",
    "Exploitability and technical risk",
    "Patch and mitigation priorities",
    "Operational impact for security teams",
    "Validation steps after remediation"
  ],
  "industry-news": [
    "Core development and timeline",
    "Technical context behind the update",
    "Why this matters for security teams",
    "Immediate response priorities",
    "Questions leaders should resolve next"
  ],
  research: [
    "Research focus and scope",
    "Methodology and key observations",
    "Practical implications for defenders",
    "Applying findings in production",
    "Limitations and unanswered questions"
  ],
  "ai-security": [
    "Model and threat context",
    "Observed failure modes",
    "Defensive controls to prioritize",
    "Risk trade-offs for adoption",
    "High-value tests to run next"
  ],
  government: [
    "Advisory summary and scope",
    "Who should act first",
    "Recommended mitigations",
    "Coordination and reporting guidance",
    "Compliance and response planning"
  ]
};

const BANNED_HEADING_PATTERNS = [
  /^what happened$/i,
  /^what this means$/i,
  /^what teams should do now$/i,
  /^what to do now$/i,
  /^key takeaways$/i,
  /^bottom line$/i,
  /^why this matters for teams$/i
];

const extractHeadingText = (line: string): string => line.replace(/^##\s+/, "").trim();

const enforceHeadingQuality = (
  content: string,
  item: RawFeedItem
): { content: string; headingCount: number } => {
  const lines = content.split("\n");
  const replacementPool = pickFallbackHeadings(item);
  let replacementIndex = 0;
  let headingCount = 0;

  const normalizedLines = lines.map((line) => {
    if (!/^##\s+/.test(line.trim())) {
      return line;
    }

    headingCount += 1;
    let heading = extractHeadingText(line);
    if (BANNED_HEADING_PATTERNS.some((pattern) => pattern.test(heading))) {
      heading = replacementPool[replacementIndex % replacementPool.length];
      replacementIndex += 1;
    }

    return `## ${stripEmojiInline(heading)}`;
  });

  return {
    content: normalizedLines.join("\n"),
    headingCount
  };
};

const ensureSectionBodies = (content: string, item: RawFeedItem): string => {
  const lines = content.split("\n");
  const fallbackSentence =
    pickSentenceRange(
      splitSentences(item.sourceSnippet || item.summary),
      0,
      2,
      "Source details are limited, so teams should verify exposure using internal telemetry and validate mitigation progress with system owners.",
      260
    ) ||
    "Source details are limited, so teams should verify exposure using internal telemetry and validate mitigation progress with system owners.";

  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    output.push(line);

    if (!/^##\s+/.test(line.trim())) {
      continue;
    }

    let probe = index + 1;
    while (probe < lines.length && !lines[probe].trim()) {
      probe += 1;
    }

    if (probe >= lines.length || /^##\s+/.test(lines[probe].trim())) {
      output.push("");
      output.push(fallbackSentence);
      output.push("");
    }
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const pickFallbackHeadings = (item: RawFeedItem): [string, string, string, string] => {
  const pool = headingPools[item.category] || headingPools["industry-news"];
  const seed = parseInt(hashString(item.url).slice(0, 6), 36) || 0;

  const first = pool[seed % pool.length];
  const second = pool[(seed + 2) % pool.length];
  const third = pool[(seed + 4) % pool.length];
  const fourth = pool[(seed + 1) % pool.length];

  return [first, second, third, fourth];
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

const trimTitleByWords = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  const words = value.split(" ").filter(Boolean);
  let built = "";
  for (const word of words) {
    const candidate = built ? `${built} ${word}` : word;
    if (candidate.length > maxLength) {
      break;
    }
    built = candidate;
  }

  return (built || value.slice(0, maxLength)).replace(/[\s:;,.!?-]+$/g, "");
};

const normalizeGeneratedTitle = (value: string, item: RawFeedItem): string => {
  const initial = stripEmojiInline((value || item.title).replace(/^['"“”]+|['"“”]+$/g, ""));
  const noTrailing = initial.replace(/[\s:;,.!?-]+$/g, "");
  const deBlanded = /^(security|cybersecurity)\s+(update|news)$/i.test(noTrailing)
    ? stripEmojiInline(item.title)
    : noTrailing;

  const tightened = trimTitleByWords(deBlanded, 72);
  if (tightened.length >= 38) {
    return tightened;
  }

  const categoryHint = item.category.replace(/-/g, " ");
  return trimTitleByWords(`${tightened}: key ${categoryHint} impact`, 72);
};

const pickCategory = (
  requestedCategory: string,
  item: RawFeedItem,
  categoryPool: string[]
): string => {
  const normalizedRequested = normalizeCategorySlug(requestedCategory);
  const normalizedItem = normalizeCategorySlug(item.category);
  const normalizedPool = [...new Set(categoryPool.map((category) => normalizeCategorySlug(category)).filter(Boolean))];

  if (normalizedRequested && normalizedPool.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  if (normalizedRequested && normalizedPool.length < 10) {
    return normalizedRequested;
  }

  if (normalizedItem && normalizedPool.includes(normalizedItem)) {
    return normalizedItem;
  }

  return normalizedPool[0] || normalizedItem || "industry-news";
};

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

const pickSentenceRange = (
  sentences: string[],
  start: number,
  end: number,
  fallback: string,
  maxLength = 700
): string => {
  const value = (sentences.slice(start, end).join(" ") || fallback).trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
};

const buildStructuredContent = (
  summary: string,
  body: string,
  item: RawFeedItem
): string => {
  const cleanedSummary = stripEmojiInline(summary) || "Security teams should review this update for potential operational impact.";
  const sourceBase = normalizeWhitespace(body || item.sourceSnippet || cleanedSummary);
  const sourceSentences = splitSentences(sourceBase);

  const overview = pickSentenceRange(
    sourceSentences,
    0,
    4,
    sourceBase || "The source described a security update, but complete technical details were not disclosed.",
    640
  );

  const technicalDetails = pickSentenceRange(
    sourceSentences,
    4,
    8,
    "Technical specifics remain limited in the available source text, so teams should validate exposure against their own environment and controls.",
    700
  );

  const operationalImpact = pickSentenceRange(
    sourceSentences,
    8,
    13,
    "Operationally, this requires a rapid assessment of affected systems, communications to owners, and verification that existing detections still cover the described behavior.",
    700
  );

  const responsePriorities = pickSentenceRange(
    sourceSentences,
    13,
    18,
    "Response planning should align technical owners, incident response, and leadership on what to validate first, what to patch first, and what telemetry to monitor during the next 24-72 hours.",
    720
  );

  const openQuestions = pickSentenceRange(
    sourceSentences,
    18,
    24,
    "Some implementation-specific details are still not disclosed, so teams should confirm assumptions with internal telemetry, vendor guidance, and environment-specific testing.",
    720
  );

  const monitoringSignals = pickSentenceRange(
    sourceSentences,
    24,
    30,
    "Teams should continuously monitor authentication anomalies, process execution chains, suspicious outbound traffic, and endpoint telemetry changes while this story evolves.",
    720
  );

  const topicLabel = item.category.replace(/-/g, " ");
  const [firstHeading, secondHeading, thirdHeading, fourthHeading] = pickFallbackHeadings(item);
  const actionHeading = `Priority actions for ${topicLabel} teams`;
  const monitoringHeading = "Monitoring and escalation checkpoints";
  const sourceHeading = "Source trail and verification notes";

  return stripEmojiMarkdown([
    `## ${firstHeading}`,
    overview,
    `## ${secondHeading}`,
    technicalDetails,
    `## ${thirdHeading}`,
    operationalImpact,
    `## ${fourthHeading}`,
    responsePriorities,
    `## ${actionHeading}`,
    [
      "- Confirm whether any production systems match the affected technology or behavior.",
      "- Validate logging, alerting, and detection coverage tied to this class of threat.",
      "- Coordinate with incident response and infrastructure owners on prioritization.",
      `- Brief leadership on potential impact to ${topicLabel} posture and immediate mitigations.`
    ].join("\n"),
    `## ${monitoringHeading}`,
    monitoringSignals,
    [
      "- Define explicit escalation criteria (severity thresholds, blast-radius growth, exploitation evidence).",
      "- Track mitigation completeness by system owner, not only by ticket status.",
      "- Re-validate controls after each change window to ensure no regression was introduced.",
      "- Keep an incident timeline so detection and response gaps are measurable and actionable."
    ].join("\n"),
    "## Critical unknowns to resolve",
    openQuestions,
    `## ${sourceHeading}`,
    `Original reporting: [Open source article](${item.url}).`,
    "Some implementation-specific details were not disclosed in the source material."
  ].join("\n\n"));
};

const normalizeGeneratedContent = (
  title: string,
  summary: string,
  content: string,
  item: RawFeedItem
): string => {
  const cleanedContent = stripEmojiMarkdown(
    dedupeOpeningSummary(summary, stripLeadingHeading(content, title))
  );
  if (!cleanedContent) {
    return buildStructuredContent(summary, item.sourceSnippet || summary, item);
  }

  const qualityAdjusted = enforceHeadingQuality(cleanedContent, item);
  const sectionAligned = ensureSectionBodies(qualityAdjusted.content, item);
  const words = countWords(sectionAligned);

  if (qualityAdjusted.headingCount >= 5 && words >= 620) {
    return stripEmojiMarkdown(sectionAligned);
  }

  return stripEmojiMarkdown(buildStructuredContent(
    summary,
    [item.sourceSnippet || "", sectionAligned].join("\n\n"),
    item
  ));
};

const fallbackArticle = (item: RawFeedItem, categoryPool: string[]): NewsletterArticle => {
  const fallbackTitle = normalizeGeneratedTitle(item.title, item);
  const baseSlug = slugify(fallbackTitle) || "security-update";
  const uniqueSlug = `${baseSlug}-${hashString(item.url).slice(0, 6)}`;
  const cleanedSummary = stripEmojiInline(
    item.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );
  const summary =
    cleanedSummary ||
    `Security teams should review this update relevant to ${item.category.replace(/-/g, " ")}.`;
  const content = buildStructuredContent(summary, item.sourceSnippet || summary, item);
  const category = pickCategory(item.category, item, categoryPool);

  return {
    title: fallbackTitle,
    slug: uniqueSlug,
    summary: truncateSummary(summary),
    content,
    category,
    tags: [category, "daily-brief", "rss"],
    source_name: "7secure",
    source_url: item.sourceUrl,
    original_url: item.url,
    image_url: item.imageUrl || DEFAULT_COVER_IMAGE,
    is_featured: false
  };
};

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
  env: WorkerEnv,
  categoryPool: string[]
): Promise<NewsletterArticle | null> => {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      console.log(`Sending to LLM (attempt ${attempt}/${maxAttempts}): ${item.title.substring(0, 30)}...`);
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
                preferred_categories: categoryPool,
                image_url: item.imageUrl || DEFAULT_COVER_IMAGE
              })
            }
          ]
        })
      });

      if (!response.ok) {
        console.error("LLM API Error:", response.status, await response.text());
        if (attempt === maxAttempts) {
          return fallbackArticle(item, categoryPool);
        }
        continue;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        console.error("No content from LLM");
        if (attempt === maxAttempts) {
          return fallbackArticle(item, categoryPool);
        }
        continue;
      }

      const parsed = extractJson(content) as any;
      if (!isValidArticle(parsed)) {
        if (attempt === maxAttempts) {
          return fallbackArticle(item, categoryPool);
        }
        continue;
      }

      const finalTitle = normalizeGeneratedTitle(parsed.title || item.title, item);
      const finalSummary = truncateSummary(stripEmojiInline(parsed.summary || item.summary));
      const finalContent = normalizeGeneratedContent(
        finalTitle,
        finalSummary,
        parsed.content,
        item
      );
      const finalCategory = pickCategory(parsed.category || item.category, item, categoryPool);

      // Default to the original item's metadata if the LLM hallucinated or forgot to include it
      return {
        ...parsed,
        title: finalTitle,
        summary: finalSummary,
        content: finalContent,
        category: finalCategory,
        source_name: "7secure",
        source_url: parsed.source_url || item.sourceUrl || "https://example.com",
        original_url: parsed.original_url || item.url || "https://example.com",
        image_url: parsed.image_url || item.imageUrl || DEFAULT_COVER_IMAGE
      } as NewsletterArticle;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.error(
          `LLM rewrite timeout after ${Math.round(LLM_TIMEOUT_MS / 1000)}s (attempt ${attempt}/${maxAttempts}) for: ${item.title.substring(0, 30)}...`
        );
      } else {
        console.error(
          `LLM Rewrite Error (${item.title}) [attempt ${attempt}/${maxAttempts}]:`,
          (error as Error).message
        );
      }

      if (attempt === maxAttempts) {
        return fallbackArticle(item, categoryPool);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return fallbackArticle(item, categoryPool);
};

export const writeArticles = async (
  items: RawFeedItem[],
  env: WorkerEnv,
  trackedCategories: string[] = DEFAULT_CATEGORY_POOL
): Promise<NewsletterArticle[]> => {
  const candidates = items.slice(0, 8);
  const results: NewsletterArticle[] = [];
  const concurrency = 3;
  const categoryPool = [...new Set([...trackedCategories, ...DEFAULT_CATEGORY_POOL])].slice(0, 10);

  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const settled = await Promise.allSettled(
      chunk.map((item) => rewriteItem(item, env, categoryPool))
    );

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
};
