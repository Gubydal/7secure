import type { WorkerEnv } from "../types";

const TITLE_SYSTEM_PROMPT = `Role: You are a senior cybersecurity editor and B2B marketing strategist writing for CISOs, IT Directors, and Compliance Officers.

Task: Generate a single, high-impact title for today's cybersecurity newsletter based on the articles listed below.

Input: You will receive article headlines and short summaries or bullet points per article.

Rules:
- Do NOT summarize the articles literally
- Synthesize the shared strategic theme or dominant risk signal across all articles
- Emphasize impact, consequence, or decision relevance
- Avoid words like "newsletter," "digest," "roundup," or "weekly"
- Maximum 14 words
- Use strong executive language: risk, exposure, resilience, intelligence, control, trust, breach, threat

Output: Return ONLY the title. No explanation.`;

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

const cleanTitle = (raw: string): string => {
  return raw
    .replace(/^["']+|["']+$/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export interface TitleInputArticle {
  title: string;
  summary: string;
  category: string;
}

export const generateNewsletterTitle = async (
  articles: TitleInputArticle[],
  env: WorkerEnv
): Promise<string> => {
  if (!articles.length) {
    return "Daily Security Intelligence Brief";
  }

  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title} (${a.category})\n   ${a.summary}`)
    .join("\n\n");

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
          { role: "system", content: TITLE_SYSTEM_PROMPT },
          { role: "user", content: articleList }
        ]
      })
    });

    if (!response.ok) {
      console.error("Title generation API error:", response.status, await response.text());
      return fallbackTitle(articles);
    }

    const payload = (await response.json()) as LLMResponsePayload;
    const content = extractLlmContent(payload);
    if (!content) {
      console.error("Title generation: empty LLM response");
      return fallbackTitle(articles);
    }

    const cleaned = cleanTitle(content);
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 14) {
      return words.slice(0, 14).join(" ");
    }
    if (words.length < 3) {
      return fallbackTitle(articles);
    }
    return cleaned;
  } catch (error) {
    console.error("Title generation error:", (error as Error).message);
    return fallbackTitle(articles);
  } finally {
    clearTimeout(timeoutId);
  }
};

const fallbackTitle = (articles: TitleInputArticle[]): string => {
  const categories = [...new Set(articles.map((a) => a.category))];
  const hasIncident = articles.some((a) =>
    /breach|attack|ransomware|exploit|compromis|intrusion/i.test(a.title)
  );
  if (hasIncident) {
    return "Active Threat Landscape: Exposure and Response Priorities";
  }
  if (categories.includes("government") || categories.includes("regulatory-watch")) {
    return "Regulatory Pressure and Compliance Exposure Intensify";
  }
  if (categories.includes("ai-security")) {
    return "AI Security Risks Demand Immediate Executive Attention";
  }
  return "Critical Security Intelligence for Today's Risk Landscape";
};
