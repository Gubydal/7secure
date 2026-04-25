import type { NewsletterArticle, RawFeedItem, WorkerEnv } from "../types";
import { isRegulatoryContent, applyRegulatoryTag } from "./regulatory-classifier";
import { classifyIncidentDetailed, isSecurityIncident } from "./incident-classifier";

const SYSTEM_PROMPT = `You are a technology copywriter specializing in AI and cybersecurity. Analyze the following article and produce a concise, intelligence-style summary in English.

First, determine whether this article describes a SECURITY INCIDENT (breach, attack, compromise, intrusion, data leak, ransomware, active exploitation, unauthorized access, etc.) or a GENERAL CYBERSECURITY DEVELOPMENT (policy, research, vulnerability disclosure, tool release, framework update, advisory, etc.).

Hard requirements:
- Title: MUST be heavily optimized, specific, catchy, and concrete. Keep it 45-72 chars. No clickbait or vague wording. Clean all garbage characters, weird numbers, random bracket expressions, or raw HTML entities.
- Summary: 2 concise sentences explaining why readers should care.
- is_incident: true if the article describes a security incident, false otherwise.

If it IS a security incident, format the body as Markdown with EXACTLY these H2 sections and NO OTHERS:
  ## Key Takeaways
  (A bulleted list of 3-5 critical facts: who, what, how; initial compromise vector and escalation path; impacted systems, data, or users; known threat actors)
  
  ## Incident Overview
  (1-2 concise paragraphs on how the attack unfolded, including: role of AI tools, third-party services, or supply chain; use of malware, stolen credentials, or misconfigurations; scope of access and exposure)
  
  ## Security Implications
  (1 paragraph on broader risks: third-party/supply chain vulnerabilities, IAM weaknesses, AI tooling risks in enterprise environments)
  
  ## Recommended Mitigations
  (A bulleted list of actionable defenses: secrets management, least privilege, third-party monitoring, endpoint hardening, phishing resistance)

If it is NOT a security incident, format the body as Markdown with EXACTLY these H2 sections and NO OTHERS:
  ## Key Takeaways
  (A bulleted list of 3-5 the most important factual points)
  
  ## Description
  (1-2 paragraphs explaining the topic clearly and concisely)
  
  ## Why It Matters
  (1-2 paragraphs on strategic or industry-level insights)

Style rules:
- Professional, analytical tone (Mandiant/CrowdStrike standard).
- High signal-to-noise ratio. Avoid unnecessary jargon, maintain technical credibility.
- Prefer proof over adjectives. Prioritize observable facts, technical behavior, and explicit uncertainty.
- Avoid hype language and generic framing such as "game changer", "critical wake-up call".
- Do not use emojis anywhere in title, summary, headings, or body.
- Use only facts present in the input. If unknown, write that it was not disclosed.
- Do not include website/source name in author voice.
- Do NOT include any promotional text, advertisements, sponsored content, webinar invitations, course promotions, whitepaper downloads, or vendor marketing material.
- Tags: 3-5 lowercase tags.
- Category: short kebab-case slug. Prefer categories from preferred_categories when possible.
- If a new category is truly needed, keep it concise (1-3 words, kebab-case).
- Slug: lowercase URL-safe with hyphens.
- image_url: use source image if available, otherwise /cover.avif.
- sufficient_data: true or false. Evaluate the input strictly. If the input summary/snippet is too short, vague, or lacks enough concrete technical details to write a high-quality summary without hallucinating, set this to false.

Input fields:
- title: original article headline.
- summary: short feed summary text.
- source_snippet: richer extracted text from the feed/article body.
- preferred_categories: existing categories in the system (max 10).

Return ONLY valid JSON:
{
  "title": "...", "slug": "...", "summary": "...", "content": "...",
  "category": "...", "tags": ["..."], "source_name": "7secure", "source_url": "...",
  "original_url": "...", "image_url": "...", "sufficient_data": true, "is_incident": false
}`;

const DEFAULT_COVER_IMAGE = "/cover.avif";
const LLM_TIMEOUT_MS = 75_000;
const LLM_RETRY_TIMEOUT_MS = 55_000;
const LLM_CHUNK_HEARTBEAT_MS = 15_000;
const LLM_DIAGNOSTIC_MAX_LEN = 420;
const MAX_REWRITE_CANDIDATES = 8;
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

const GARBAGE_PATTERNS = [
  /lead the future of[^.]*?georgetown/i,
  /online master'?s? from georgetown/i,
  /cybersecurity insiders/i,
  /zscaler threatlabz \d{4} vpn risk report/i,
  /download the full report/i,
  /register now for/i,
  /sign up today/i,
  /limited time offer/i,
  / sponsored /i,
  /advertisement/i,
  /promotional content/i,
  /click here to learn more/i,
  /read the whitepaper/i,
  /request a demo/i,
  /free trial/i,
  /subscribe to our newsletter/i
];

const stripGarbageText = (value: string): string => {
  let cleaned = value;
  for (const pattern of GARBAGE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return normalizeWhitespace(cleaned);
};

const dedupeAcrossSections = (sections: string[]): string[] => {
  const seen = new Set<string>();
  return sections.map((section) => {
    const normalized = normalizeWhitespace(section).toLowerCase();
    if (seen.has(normalized)) {
      return "";
    }
    for (const existing of seen) {
      if (normalized.includes(existing) || existing.includes(normalized)) {
        if (normalized.length < existing.length) {
          return "";
        }
      }
    }
    seen.add(normalized);
    return section;
  });
};

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

const toPlainText = (value: string): string =>
  normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^\)]*\)/g, " ")
      .replace(/^#{1,6}\s+/gm, " ")
      .replace(/[*_>~]/g, " ")
      .replace(/\s+/g, " ")
  );

const clampSnippet = (value: string, maxLength: number): string => {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) {
    return "";
  }
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength - 3).trimEnd()}...`
    : cleaned;
};

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

const normalizeKeyPoints = (
  keyPointsSection: string,
  sourceText: string,
  topicLabel: string
): string[] => {
  const bulletLines = keyPointsSection
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);

  const sentenceSeed = [
    ...splitSentences(toPlainText(keyPointsSection)),
    ...splitSentences(toPlainText(sourceText))
  ];

  const seeded = bulletLines.length > 0 ? bulletLines : sentenceSeed;
  const unique: string[] = [];

  for (const sentence of seeded) {
    const cleaned = clampSnippet(sentence, 180);
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

  const fallback = [
    `Source reporting indicates a live ${topicLabel} development that requires triage.`,
    "Key implementation details are partially disclosed and should be validated with internal telemetry.",
    "Teams should align ownership, exposure assessment, and near-term mitigation sequencing."
  ];

  for (const line of fallback) {
    if (unique.length >= 3) {
      break;
    }
    unique.push(line);
  }

  return unique;
};

const inferEvidenceArtifact = (item: RawFeedItem): string => {
  const signal = `${item.title} ${item.summary} ${item.sourceSnippet || ""}`;
  const cve = signal.match(/CVE-\d{4}-\d{4,7}/i);
  if (cve) {
    return cve[0].toUpperCase();
  }

  const product = signal.match(/\b(?:Windows|Linux|VMware|Citrix|Cisco|Fortinet|Ivanti|Apple|Android|Microsoft|Chrome|Kubernetes|WordPress)\b/i);
  if (product) {
    return `${product[0]}-related activity`;
  }

  const actor = signal.match(/\b(?:APT\d+|Lazarus|LockBit|Akira|Clop|FIN\d+|Sandworm|Volt Typhoon)\b/i);
  if (actor) {
    return `${actor[0]} operations`;
  }

  const date = signal.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i);
  if (date) {
    return `the ${date[0]} advisory window`;
  }

  return "the source-reported security artifact";
};

const buildStructuredContent = (
  summary: string,
  body: string,
  item: RawFeedItem,
  sections?: { keyPoints?: string; description?: string; whyImportant?: string; incidentOverview?: string; securityImplications?: string; recommendedMitigations?: string },
  isIncident = false
): string => {
  const cleanedSummary = stripEmojiInline(summary) || "Security teams should review this update for potential operational impact.";
  const sourceBase = normalizeWhitespace(
    [body, item.sourceSnippet || "", cleanedSummary].filter(Boolean).join(" ")
  );
  const sourceSentences = splitSentences(sourceBase);
  const topicLabel = item.category.replace(/-/g, " ");

  if (isIncident) {
    const incidentOverview = clampSnippet(
      toPlainText(
        sections?.incidentOverview ||
          pickSentenceRange(
            sourceSentences,
            0,
            5,
            sourceBase || "The source described a security incident, but complete technical details were not disclosed.",
            760
          )
      ),
      760
    );

    const securityImplications = clampSnippet(
      toPlainText(
        sections?.securityImplications ||
          pickSentenceRange(
            sourceSentences,
            5,
            10,
            `For ${topicLabel} teams, this incident signals potential supply chain, IAM, or third-party exposure that should be validated against internal telemetry.`,
            760
          )
      ),
      760
    );

    const keyPoints = normalizeKeyPoints(
      sections?.keyPoints || "",
      [incidentOverview, securityImplications, sourceBase].filter(Boolean).join(" "),
      topicLabel
    );

    const mitigations = sections?.recommendedMitigations || "- Validate exposure through internal telemetry and detection coverage.\n- Review third-party access and supply chain dependencies.\n- Enforce least-privilege and secrets rotation.";

    return stripEmojiMarkdown(
      [
        "## Key Takeaways",
        keyPoints.map((point) => `- ${point}`).join("\n"),
        "## Incident Overview",
        incidentOverview,
        "## Security Implications",
        securityImplications,
        "## Recommended Mitigations",
        mitigations
      ].join("\n\n")
    );
  }

  const description = clampSnippet(
    toPlainText(
      sections?.description ||
        pickSentenceRange(
          sourceSentences,
          0,
          5,
          sourceBase ||
            "The source described a security update, but complete technical details were not disclosed.",
          760
        )
    ),
    760
  );

  const whyImportant = clampSnippet(
    toPlainText(
      sections?.whyImportant ||
        pickSentenceRange(
          sourceSentences,
          5,
          10,
          `For ${topicLabel} teams, this update should be treated as a prioritization signal and validated against live asset exposure, detection coverage, and response readiness.`,
          760
        )
    ),
    760
  );

  const keyPoints = normalizeKeyPoints(
    sections?.keyPoints || "",
    [description, whyImportant, sourceBase].filter(Boolean).join(" "),
    topicLabel
  );

  return stripEmojiMarkdown(
    [
      "## Key Takeaways",
      keyPoints.map((point) => `- ${point}`).join("\n"),
      "## Description",
      description,
      "## Why It Matters",
      whyImportant
    ].join("\n\n")
  );
};

const normalizeGeneratedContent = (
  title: string,
  summary: string,
  content: string,
  item: RawFeedItem,
  isIncident = false
): string => {
  const cleanedContent = stripEmojiMarkdown(
    dedupeOpeningSummary(summary, stripLeadingHeading(content, title))
  );
  if (!cleanedContent) {
    return buildStructuredContent(summary, item.sourceSnippet || summary, item, undefined, isIncident);
  }

  // Try new intelligence-style sections first
  const keyTakeaways = extractMarkdownSection(cleanedContent, [
    /##\s*Key\s*Takeaways?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const keyPoints = extractMarkdownSection(cleanedContent, [
    /##\s*Key\s*Points?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const incidentOverview = extractMarkdownSection(cleanedContent, [
    /##\s*Incident\s*Overview\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const securityImplications = extractMarkdownSection(cleanedContent, [
    /##\s*Security\s*Implications?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const recommendedMitigations = extractMarkdownSection(cleanedContent, [
    /##\s*Recommended\s*Mitigations?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const description = extractMarkdownSection(cleanedContent, [
    /##\s*Description\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const whyItMatters = extractMarkdownSection(cleanedContent, [
    /##\s*Why\s+It\s+Matters?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const whyImportant = extractMarkdownSection(cleanedContent, [
    /##\s*(?:Why\s+this\s+matters|Why\s+it'?s\s+important)\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);

  // Detect if content has incident-style sections
  const hasIncidentSections = incidentOverview || securityImplications || recommendedMitigations;
  const resolvedIsIncident = isIncident || Boolean(hasIncidentSections);

  if (resolvedIsIncident) {
    return buildStructuredContent(
      summary,
      [item.sourceSnippet || "", cleanedContent].join("\n\n"),
      item,
      {
        keyPoints: keyTakeaways || keyPoints,
        incidentOverview,
        securityImplications,
        recommendedMitigations
      },
      true
    );
  }

  const legacyDescriptionBlocks = extractMarkdownSections(cleanedContent, [
    /##\s*Evidence snapshot[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*How\s+[^\n]*works\s+technically[^\n]*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const legacyWhyBlocks = extractMarkdownSections(cleanedContent, [
    /##\s*Who\s+is\s+exposed\s+and\s+blast\s+radius[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*Remediation\s+steps[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*Detection\s+and\s+validation[^\n]*\n([\s\S]*?)(?=\n##|$)/i,
    /##\s*Forward\s+outlook[^\n]*\n([\s\S]*?)(?=\n##|$)/i
  ]);

  return buildStructuredContent(
    summary,
    [item.sourceSnippet || "", cleanedContent].join("\n\n"),
    item,
    {
      keyPoints: keyTakeaways || keyPoints,
      description: description || legacyDescriptionBlocks.join("\n\n"),
      whyImportant: whyItMatters || whyImportant || legacyWhyBlocks.join("\n\n") || summary
    },
    false
  );
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
  const deterministicIncident = isSecurityIncident(item);
  const content = buildStructuredContent(summary, item.sourceSnippet || summary, item, undefined, deterministicIncident);
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
    is_featured: false,
    is_incident: deterministicIncident
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

interface LLMResponseMessage {
  content?: string | Array<string | { type?: string; text?: string; content?: string }>;
  output_text?: string;
  reasoning_content?: string;
}

interface LLMResponseChoice {
  message?: LLMResponseMessage;
  text?: string;
  finish_reason?: string;
}

interface LLMResponsePayload {
  choices?: LLMResponseChoice[];
  output_text?: string;
}

const firstNonEmptyText = (values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const extractMessageContent = (message: LLMResponseMessage | undefined): string => {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const joined = message.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (!part || typeof part !== "object") {
          return "";
        }

        const text =
          (typeof part.text === "string" && part.text) ||
          (typeof part.content === "string" && part.content) ||
          "";
        return text;
      })
      .filter(Boolean)
      .join("\n")
      .trim();

    if (joined) {
      return joined;
    }
  }

  return firstNonEmptyText([message.output_text, message.reasoning_content]);
};

const extractLlmContent = (payload: LLMResponsePayload): string => {
  const firstChoice = payload.choices?.[0];
  const fromMessage = extractMessageContent(firstChoice?.message);
  if (fromMessage) {
    return fromMessage;
  }

  return firstNonEmptyText([firstChoice?.text, payload.output_text]);
};

const buildLlmPayloadDiagnostic = (payload: LLMResponsePayload): string => {
  const firstChoice = payload.choices?.[0] as
    | (Record<string, unknown> & { finish_reason?: string })
    | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;

  const diagnostic = {
    choiceCount: Array.isArray(payload.choices) ? payload.choices.length : 0,
    finishReason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined,
    firstChoiceKeys: firstChoice ? Object.keys(firstChoice).slice(0, 10) : [],
    messageKeys: message ? Object.keys(message).slice(0, 10) : [],
    hasFallbackText: Boolean(
      firstNonEmptyText([
        payload.output_text,
        message?.output_text,
        message?.reasoning_content,
        firstChoice?.text
      ])
    )
  };

  return JSON.stringify(diagnostic).slice(0, LLM_DIAGNOSTIC_MAX_LEN);
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
  const rewriteStartedAt = Date.now();
  const deterministicClassification = classifyIncidentDetailed(item);
  console.log(
    `Incident classification for "${item.title.substring(0, 50)}...": score=${deterministicClassification.score}, confidence=${deterministicClassification.confidence}, isIncident=${deterministicClassification.isIncident}, signals=[${deterministicClassification.signals.join(", ")}]`
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutMs = attempt === 1 ? LLM_TIMEOUT_MS : LLM_RETRY_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
                source_snippet: stripGarbageText(item.sourceSnippet || ""),
                published_at: item.publishedAt,
                source_name: item.sourceName,
                source_url: item.sourceUrl,
                category: item.category,
                preferred_categories: categoryPool,
                image_url: item.imageUrl || DEFAULT_COVER_IMAGE,
                likely_incident: deterministicClassification.isIncident,
                incident_signals: deterministicClassification.signals
              })
            }
          ]
        })
      });

      if (!response.ok) {
        console.error("LLM API Error:", response.status, await response.text());
        if (attempt === maxAttempts) {
          console.warn(`Falling back to deterministic article for ${item.title.substring(0, 60)} (LLM API error)`);
          return fallbackArticle(item, categoryPool);
        }
        continue;
      }

      const payload = (await response.json()) as LLMResponsePayload;

      const content = extractLlmContent(payload);
      if (!content) {
        console.error(`No content from LLM. Diagnostic: ${buildLlmPayloadDiagnostic(payload)}`);
        if (attempt === maxAttempts) {
          console.warn(`Falling back to deterministic article for ${item.title.substring(0, 60)} (empty LLM content)`);
          return fallbackArticle(item, categoryPool);
        }
        continue;
      }

      const parsed = extractJson(content) as any;
      if (parsed && parsed.sufficient_data === false) {
        console.warn(`LLM rejected article due to insufficient data: ${item.title.substring(0, 60)}`);
        return null;
      }

      if (!isValidArticle(parsed)) {
        if (attempt === maxAttempts) {
          console.warn(`Falling back to deterministic article for ${item.title.substring(0, 60)} (invalid JSON payload)`);
          return fallbackArticle(item, categoryPool);
        }
        continue;
      }

      const finalTitle = normalizeGeneratedTitle(parsed.title || item.title, item);
      const finalSummary = truncateSummary(stripEmojiInline(parsed.summary || item.summary));
      const isIncident = Boolean(parsed.is_incident);
      const finalContent = normalizeGeneratedContent(
        finalTitle,
        finalSummary,
        parsed.content,
        item,
        isIncident
      );
      const finalCategory = pickCategory(parsed.category || item.category, item, categoryPool);

      // Apply regulatory tag classification
      let finalTags = Array.isArray(parsed.tags) ? parsed.tags : [finalCategory, "daily-brief"];
      if (isRegulatoryContent(item)) {
        finalTags = applyRegulatoryTag(finalTags);
      }

      console.log(
        `LLM rewrite complete: ${item.title.substring(0, 40)}... in ${Math.round((Date.now() - rewriteStartedAt) / 1000)}s (incident=${isIncident})`
      );

      // Default to the original item's metadata if the LLM hallucinated or forgot to include it
      return {
        ...parsed,
        title: finalTitle,
        summary: finalSummary,
        content: finalContent,
        category: finalCategory,
        tags: finalTags,
        is_incident: isIncident,
        source_name: "7secure",
        source_url: parsed.source_url || item.sourceUrl || "https://example.com",
        original_url: parsed.original_url || item.url || "https://example.com",
        image_url: parsed.image_url || item.imageUrl || DEFAULT_COVER_IMAGE
      } as NewsletterArticle;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.error(
          `LLM rewrite timeout after ${Math.round(timeoutMs / 1000)}s (attempt ${attempt}/${maxAttempts}) for: ${item.title.substring(0, 30)}...`
        );
      } else {
        console.error(
          `LLM Rewrite Error (${item.title}) [attempt ${attempt}/${maxAttempts}]:`,
          (error as Error).message
        );
      }

      if (attempt === maxAttempts) {
        console.warn(`Falling back to deterministic article for ${item.title.substring(0, 60)} (exception path)`);
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
  const candidates = items.slice(0, MAX_REWRITE_CANDIDATES);
  const results: NewsletterArticle[] = [];
  const concurrency = 2;
  const categoryPool = [...new Set([...trackedCategories, ...DEFAULT_CATEGORY_POOL])].slice(0, 10);
  const totalChunks = Math.ceil(candidates.length / concurrency);

  console.log(
    `LLM rewrite queue: processing ${candidates.length}/${items.length} candidate items with concurrency ${concurrency}`
  );

  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const chunkNumber = Math.floor(index / concurrency) + 1;
    const pendingLabels = new Set(chunk.map((item) => item.title.substring(0, 36)));

    const wrapped = chunk.map((item) => {
      const label = item.title.substring(0, 36);
      return rewriteItem(item, env, categoryPool).finally(() => {
        pendingLabels.delete(label);
      });
    });

    const heartbeatId = setInterval(() => {
      if (!pendingLabels.size) {
        return;
      }

      const sample = [...pendingLabels].slice(0, 2).join(" | ");
      const suffix = pendingLabels.size > 2 ? " | ..." : "";
      console.log(
        `LLM rewrite in-flight: chunk ${chunkNumber}/${totalChunks}, pending ${pendingLabels.size} item(s)${sample ? ` (${sample}${suffix})` : ""}`
      );
    }, LLM_CHUNK_HEARTBEAT_MS);

    const settled = await Promise.allSettled(wrapped);
    clearInterval(heartbeatId);

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }

    console.log(
      `LLM rewrite progress: ${Math.min(index + concurrency, candidates.length)}/${candidates.length} processed, ${results.length} prepared`
    );
  }

  return results;
};
