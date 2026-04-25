import type { Metadata } from "next";
import Link from "next/link";
import { MarkdownRenderer } from "../../../components/MarkdownRenderer";
import { formatDate } from "../../../lib/utils";
import { supabasePublic, type ArticleRecord } from "../../../lib/supabase";

export const runtime = "edge";

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u200D]/gu;

const stripEmojiInline = (value: string): string => value.replace(EMOJI_REGEX, "").replace(/\s+/g, " ").trim();

const stripEmojiMarkdown = (value: string): string =>
  value
    .replace(EMOJI_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const stripLeadingHeading = (content: string): string =>
  content
    .replace(/^\uFEFF/, "")
    .replace(/^#{1,3}\s+.*?(?:\r?\n)+/, "")
    .trim();

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

const removeRepeatedSummaryInBody = (content: string, summary: string): string => {
  const blocks = stripLeadingHeading(content)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return "";
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

const splitSentences = (value: string): string[] => {
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.map((sentence) => sentence.replace(/\s+/g, " ").trim()).filter(Boolean);
};

const toPlainText = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/[*_>~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const clampText = (value: string, limit: number): string =>
  value.length > limit ? `${value.slice(0, limit - 3).trimEnd()}...` : value;

const extractMarkdownSection = (content: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
};

const extractMarkdownSections = (content: string, patterns: RegExp[]): string[] => {
  const blocks: string[] = [];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      blocks.push(value);
    }
  }
  return blocks;
};

const buildKeyPoints = (keyPointsSection: string, sourceText: string, category: string): string[] => {
  const rawBullets = keyPointsSection
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);

  const sentenceSeed = [
    ...splitSentences(toPlainText(keyPointsSection)),
    ...splitSentences(toPlainText(sourceText))
  ];

  const seeded = rawBullets.length > 0 ? rawBullets : sentenceSeed;
  const unique: string[] = [];

  for (const sentence of seeded) {
    const cleaned = clampText(sentence.replace(/\s+/g, " ").trim(), 180);
    if (!cleaned || unique.some((existing) => tokenSimilarity(existing, cleaned) >= 0.9)) {
      continue;
    }
    unique.push(cleaned);
    if (unique.length >= 4) {
      break;
    }
  }

  if (unique.length >= 2) {
    return unique;
  }

  const topicLabel = category.replace(/-/g, " ");
  return [
    `Source reporting indicates a live ${topicLabel} development that requires triage.`,
    "Key implementation details are partially disclosed and should be validated with internal telemetry.",
    "Teams should align ownership, exposure assessment, and mitigation sequencing."
  ];
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

const normalizeArticleSections = (content: string, summary: string, category: string): string => {
  const cleaned = stripLeadingHeading(content);

  // Try new intelligence-style sections first
  const keyTakeaways = extractMarkdownSection(cleaned, [
    /##\s*Key\s*Takeaways?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const keyPoints = extractMarkdownSection(cleaned, [
    /##\s*Key\s*Points?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const incidentOverview = extractMarkdownSection(cleaned, [
    /##\s*Incident\s*Overview\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const securityImplications = extractMarkdownSection(cleaned, [
    /##\s*Security\s*Implications?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const recommendedMitigations = extractMarkdownSection(cleaned, [
    /##\s*Recommended\s*Mitigations?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const description = extractMarkdownSection(cleaned, [
    /##\s*Description\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const whyItMatters = extractMarkdownSection(cleaned, [
    /##\s*Why\s+It\s+Matters?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const whyImportant = extractMarkdownSection(cleaned, [
    /##\s*(?:Why\s+this\s+matters|Why\s+it'?s\s+important)\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);

  const hasIncidentSections = incidentOverview || securityImplications || recommendedMitigations;

  if (hasIncidentSections) {
    const sourceText = toPlainText([summary, cleaned].filter(Boolean).join("\n\n"));
    const sourceSentences = splitSentences(sourceText);

    const normalizedOverview = clampText(
      toPlainText(
        incidentOverview ||
          pickSentenceRange(
            sourceSentences,
            0,
            5,
            "The source described a security incident, but complete technical details were not disclosed.",
            760
          )
      ),
      760
    );

    const normalizedImplications = clampText(
      toPlainText(
        securityImplications ||
          pickSentenceRange(
            sourceSentences,
            5,
            10,
            `For ${category.replace(/-/g, " ")} teams, this incident signals potential supply chain, IAM, or third-party exposure that should be validated against internal telemetry.`,
            760
          )
      ),
      760
    );

    const normalizedKeyPoints = buildKeyPoints(
      keyTakeaways || keyPoints,
      [normalizedOverview, normalizedImplications, sourceText].filter(Boolean).join(" "),
      category
    );

    const normalizedMitigations = recommendedMitigations || "- Validate exposure through internal telemetry and detection coverage.\n- Review third-party access and supply chain dependencies.\n- Enforce least-privilege and secrets rotation.";

    return [
      "## Key Takeaways",
      normalizedKeyPoints.map((point) => `- ${point}`).join("\n"),
      "## Incident Overview",
      normalizedOverview,
      "## Security Implications",
      normalizedImplications,
      "## Recommended Mitigations",
      normalizedMitigations
    ].join("\n\n");
  }

  const legacyDescription = extractMarkdownSections(cleaned, [
    /##\s*Evidence snapshot[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*How\s+[^\n]*works\s+technically[^\n]*\n([\s\S]*?)(?=\n##|$)/i
  ]).join("\n\n");

  const legacyWhy = extractMarkdownSections(cleaned, [
    /##\s*Who\s+is\s+exposed\s+and\s+blast\s+radius[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*Remediation\s+steps[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*Detection\s+and\s+validation[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*Forward\s+outlook[^\n]*\n([\s\S]*?)(?=\n##|$)/i
  ]).join("\n\n");

  const sourceText = toPlainText([summary, cleaned].filter(Boolean).join("\n\n"));
  const sourceSentences = splitSentences(sourceText);

  const normalizedDescription = clampText(
    toPlainText(
      description ||
        legacyDescription ||
        pickSentenceRange(
          sourceSentences,
          0,
          5,
          "The source described a security update, but complete technical details were not disclosed.",
          760
        )
    ),
    760
  );

  const normalizedWhy = clampText(
    toPlainText(
      whyItMatters ||
        whyImportant ||
        legacyWhy ||
        pickSentenceRange(
          sourceSentences,
          5,
          10,
          `For ${category.replace(/-/g, " ")} teams, this update should be treated as a prioritization signal and validated against live asset exposure and detection coverage.`,
          760
        )
    ),
    760
  );

  const normalizedKeyPoints = buildKeyPoints(
    keyTakeaways || keyPoints,
    [normalizedDescription, normalizedWhy, sourceText].filter(Boolean).join(" "),
    category
  );

  return [
    "## Key Takeaways",
    normalizedKeyPoints.map((point) => `- ${point}`).join("\n"),
    "## Description",
    normalizedDescription,
    "## Why It Matters",
    normalizedWhy
  ].join("\n\n");
};

const estimateReadMinutes = (content: string): number => {
  const words = content
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>\[\]\(\)!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(2, Math.round(words / 190));
};

const getDomain = (value: string): string => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
};

const getArticleBySlug = async (slug: string): Promise<ArticleRecord | null> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url")
    .eq("slug", slug)
    .single();

  return (data as ArticleRecord | null) ?? null;
};

const getRelated = async (category: string, currentSlug: string): Promise<ArticleRecord[]> => {
  const { data } = await supabasePublic
    .from("articles")
    .select("id,slug,title,summary,content,category,source_name,source_url,original_url,published_at,is_featured,tags,image_url")
    .eq("category", category)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3);

  return (data as ArticleRecord[] | null) ?? [];
};

// Removed generateStaticParams because Cloudflare Pages Edge Runtime does not support static param generation alongside the edge runtime.

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    return { title: "Article not found" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev";
  const url = `${siteUrl}/articles/${article.slug}`;
  const cleanTitle = stripEmojiInline(article.title);
  const cleanSummary = stripEmojiInline(article.summary);

  return {
    title: `${cleanTitle} | 7secure`,
    description: cleanSummary,
    openGraph: {
      title: cleanTitle,
      description: cleanSummary,
      url,
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description: cleanSummary
    }
  };
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return <p>Article not found.</p>;
  }

  const related = await getRelated(article.category, article.slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev";
  const articleUrl = `${siteUrl}/articles/${article.slug}`;
  const cleanTitle = stripEmojiInline(article.title);
  const cleanSummary = stripEmojiInline(article.summary);
  const renderedContent = stripEmojiMarkdown(
    normalizeArticleSections(
      removeRepeatedSummaryInBody(article.content, article.summary) || stripLeadingHeading(article.content),
      article.summary,
      article.category
    )
  );
  const readMinutes = estimateReadMinutes(renderedContent);
  const sourceDomain = getDomain(article.original_url).toUpperCase();
  const sourceThumbnail =
    article.image_url && !/cover\.avif(?:$|\?)/i.test(article.image_url)
      ? article.image_url
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: cleanTitle,
    description: cleanSummary,
    datePublished: article.published_at,
    dateModified: article.published_at,
    mainEntityOfPage: articleUrl,
    publisher: {
      "@type": "Organization",
      name: "7secure"
    },
    author: {
      "@type": "Organization",
      name: "7secure Editorial"
    },
    url: articleUrl
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="bg-white text-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
            {cleanTitle}
          </h1>

          <div className="mt-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 p-2">
              <img src="/brand/Small_Icon.svg" alt="7secure" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xl font-semibold leading-none tracking-tight text-zinc-900 sm:text-2xl">7secure</p>
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{formatDate(article.published_at)} · {readMinutes} min</p>
            </div>
          </div>

          <div className="mt-7 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            <img
              src="/cover.avif"
              alt="7secure article cover"
              className="h-auto w-full max-h-75 object-cover sm:max-h-95 lg:max-h-105"
            />
          </div>

          {sourceThumbnail ? (
            <a
              href={article.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition-colors hover:border-zinc-300"
            >
              <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr] sm:items-center">
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  <img
                    src={sourceThumbnail}
                    alt={`Source thumbnail from ${sourceDomain}`}
                    className="h-32 w-full object-cover sm:h-full"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Source thumbnail</p>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700">{sourceDomain}</p>
                  <p className="mt-1 line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900">{cleanTitle}</p>
                  <p className="mt-2 text-sm text-blue-600">Open original reporting</p>
                </div>
              </div>
            </a>
          ) : null}


        </div>

        <div className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8 lg:pb-12">
          <div className="rounded-lg border-2 border-zinc-900 bg-white p-5 sm:p-6 lg:p-7">
            <MarkdownRenderer content={renderedContent} />
          </div>
        </div>

        <div className="mx-auto max-w-4xl border-t border-zinc-200 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Related articles</h2>
          {related.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
              No related articles yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/articles/${item.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row"
                >
                  <div className="h-40 w-full overflow-hidden bg-zinc-100 sm:h-auto sm:w-56 md:w-64">
                    <img
                      src={item.image_url || "/cover.avif"}
                      alt={item.title}
                      className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{item.category.replace(/-/g, " ")}</p>
                    <h3 className="text-base font-semibold tracking-tight text-zinc-950 sm:text-lg">{stripEmojiInline(item.title)}</h3>
                    <p className="line-clamp-2 text-sm leading-6 text-zinc-600">{stripEmojiInline(item.summary)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
