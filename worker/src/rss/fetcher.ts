import { parseFeedXml } from "./parser";
import { RSS_SOURCES } from "./sources";
import type { RawFeedItem, RSSSource } from "../types";

const fetchSingleSource = async (source: RSSSource): Promise<RawFeedItem[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${source.url}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const parsed = parseFeedXml(xml, source);
    console.log(`Successfully parsed ${parsed.length} items from ${source.url}`);
    return parsed;
  } catch (error) {
    console.error(`Error fetching/parsing ${source.url}:`, (error as Error).message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchFeeds = async (): Promise<RawFeedItem[]> => {
  const reliableSourceNames = new Set([
    "Malwarebytes",
    "Dark Reading",
    "SecurityWeek",
    "The Hacker News",
    "ZDNet Security",
    "Palo Alto Unit42",
    "SANS ISC",
    "Medium Cybersecurity",
    "BleepingComputer",
    "Krebs on Security",
    "Ars Technica",
    "AWS Security",
    "Cloudflare Security",
    "Google Cloud Security",
    "Rapid7",
    "Snyk",
    "Palo Alto Unit42",
    "OpenAI Blog",
    "Anthropic",
    "Google Research",
    "NIST CSRC",
    "CISA Alerts"
  ]);

  // Keep the worker focused on sources that are actually returning usable items.
  // This avoids wasting subrequests on feeds that routinely 404, rate-limit, or emit invalid XML.
  const subset = RSS_SOURCES
    .filter((source) => reliableSourceNames.has(source.name))
    .slice(0, 20);

  const settled = await Promise.allSettled(
    subset.map((source) => fetchSingleSource(source))
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<RawFeedItem[]> => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((item) => Boolean(item.url && item.title));
};
