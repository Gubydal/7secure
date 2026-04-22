import type { RawFeedItem } from "../types";

const HIGH_SIGNAL_SOURCES = new Set([
  "CISA Alerts",
  "Krebs on Security",
  "BleepingComputer",
  "The Hacker News",
  "Dark Reading",
  "Malwarebytes",
  "SecurityWeek",
  "ZDNet Security",
  "Palo Alto Unit42",
  "SANS ISC"
]);

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleSimilarity = (a: string, b: string): number => {
  const setA = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const setB = new Set(normalizeTitle(b).split(" ").filter(Boolean));

  if (!setA.size || !setB.size) {
    return 0;
  }

  const intersection = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
};

const normalizeArticleUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";

    const trackingKeys = [
      "gclid",
      "fbclid",
      "mc_cid",
      "mc_eid",
      "mkt_tok",
      "igshid",
      "ref",
      "ref_src"
    ];

    for (const key of [...url.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || trackingKeys.includes(lowerKey)) {
        url.searchParams.delete(key);
      }
    }

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return trimmed;
  }
};

const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
};

export const cleanItems = (items: RawFeedItem[]): RawFeedItem[] => {
  const minSummary = items.filter((item) => {
    const summaryLength = item.summary.trim().length;
    const snippetLength = (item.sourceSnippet || "").trim().length;
    return Math.max(summaryLength, snippetLength) >= 30;
  });

  const dedupedByUrl = new Map<string, RawFeedItem>();
  for (const item of minSummary) {
    const normalizedUrl = normalizeArticleUrl(item.url);
    if (!normalizedUrl) {
      continue;
    }

    if (!dedupedByUrl.has(normalizedUrl)) {
      dedupedByUrl.set(normalizedUrl, {
        ...item,
        url: normalizedUrl
      });
    }
  }

  const uniqueTitles: RawFeedItem[] = [];
  for (const item of dedupedByUrl.values()) {
    const nearDuplicate = uniqueTitles.some(
      (existing) => titleSimilarity(existing.title, item.title) >= 0.8
    );
    if (!nearDuplicate) {
      uniqueTitles.push(item);
    }
  }

  const sorted = uniqueTitles.sort((a, b) => {
    const highSignalDelta =
      Number(HIGH_SIGNAL_SOURCES.has(b.sourceName)) -
      Number(HIGH_SIGNAL_SOURCES.has(a.sourceName));
    if (highSignalDelta !== 0) {
      return highSignalDelta;
    }
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  return sorted.slice(0, 30).map(item => ({
    ...item,
    title: decodeHtmlEntities(item.title).trim(),
    summary: decodeHtmlEntities(item.summary).trim(),
    sourceSnippet: item.sourceSnippet ? decodeHtmlEntities(item.sourceSnippet).trim() : undefined
  }));
};
