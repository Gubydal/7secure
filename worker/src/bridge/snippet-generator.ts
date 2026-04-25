import type { WorkerEnv, ArticleSnippet } from "../types";

const SNIPPET_SYSTEM_PROMPT = `You are a cybersecurity editor writing teaser hooks for a daily intelligence briefing.

Given article summaries, write a single compelling sentence (maximum 20 words) per article that teases the key risk, finding, or takeaway.

Rules per hook:
- Be direct. Use active voice.
- No buzzwords like "game-changer", "groundbreaking", "revolutionary".
- Focus on consequence, exposure, or decision relevance.
- Maximum 20 words per hook.

Output format: Return ONLY a JSON array. Each object must have:
- "slug": the article slug
- "hook": the teaser sentence

Example:
[
  {"slug": "article-one", "hook": "A critical VPN flaw exposes internal networks to unauthenticated remote code execution."},
  {"slug": "article-two", "hook": "New AI regulations force compliance teams to re-evaluate third-party model governance."}
]`;

const LLM_TIMEOUT_MS = 45_000;

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
  if (!message) return "";
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (Array.isArray(message.content)) {
    const joined = message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        return (typeof part.text === "string" && part.text) ||
          (typeof part.content === "string" && part.content) || "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  return firstNonEmptyText([message.output_text, message.reasoning_content]);
};

const extractLlmContent = (payload: LLMResponsePayload): string => {
  const firstChoice = payload.choices?.[0];
  const fromMessage = extractMessageContent(firstChoice?.message);
  if (fromMessage) return fromMessage;
  return firstNonEmptyText([firstChoice?.text, payload.output_text]);
};

export interface SnippetInputArticle {
  title: string;
  slug: string;
  summary: string;
}

const fallbackSnippets = (articles: SnippetInputArticle[]): ArticleSnippet[] => {
  return articles.map((a) => ({
    title: a.title,
    slug: a.slug,
    hook: `${a.title.split(" ").slice(0, 6).join(" ")} carries immediate security implications.`
  }));
};

export const generateSnippetOfTheWeek = async (
  articles: SnippetInputArticle[],
  env: WorkerEnv
): Promise<ArticleSnippet[]> => {
  if (!articles.length) {
    return [];
  }

  const articleList = articles
    .map((a) => `slug: ${a.slug}\ntitle: ${a.title}\nsummary: ${a.summary}`)
    .join("\n\n---\n\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: SNIPPET_SYSTEM_PROMPT },
          { role: "user", content: articleList }
        ]
      })
    });

    if (!response.ok) {
      console.error("Snippet generation API error:", response.status, await response.text());
      return fallbackSnippets(articles);
    }

    const payload = (await response.json()) as LLMResponsePayload;
    const content = extractLlmContent(payload);
    if (!content) {
      console.error("Snippet generation: empty LLM response");
      return fallbackSnippets(articles);
    }

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Snippet generation: no JSON array found in response");
      return fallbackSnippets(articles);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ slug?: string; hook?: string }>;
      const valid = parsed
        .filter((p): p is { slug: string; hook: string } =>
          typeof p.slug === "string" && typeof p.hook === "string"
        )
        .map((p) => ({
          title: articles.find((a) => a.slug === p.slug)?.title || p.slug,
          slug: p.slug,
          hook: p.hook.slice(0, 140)
        }));

      if (valid.length === 0) {
        return fallbackSnippets(articles);
      }
      return valid;
    } catch {
      console.error("Snippet generation: JSON parse failed");
      return fallbackSnippets(articles);
    }
  } catch (error) {
    console.error("Snippet generation error:", (error as Error).message);
    return fallbackSnippets(articles);
  } finally {
    clearTimeout(timeoutId);
  }
};
