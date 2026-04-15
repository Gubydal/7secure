import type { RawFeedItem } from "../types";

const HIGH_SIGNAL_SOURCES = new Set([
  "CISA Alerts",
  "Krebs on Security",
  "BleepingComputer",
  "The Hacker News",
  "Dark Reading"
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

export const cleanItems = (items: RawFeedItem[]): RawFeedItem[] => {
  const minSummary = items.filter((item) => item.summary.trim().length >= 30);

  const dedupedByUrl = new Map<string, RawFeedItem>();
  for (const item of minSummary) {
    if (!dedupedByUrl.has(item.url)) {
      dedupedByUrl.set(item.url, item);
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

  return sorted.slice(0, 30);
};
