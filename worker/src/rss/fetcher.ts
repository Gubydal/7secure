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
  const blockedSourceNames = new Set([
    "Abuse.ch",
    "Alignment Forum",
    "BankInfoSecurity",
    "Bitdefender Labs",
    "CISA Alerts",
    "Darknet Diaries",
    "Fortinet",
    "GitHub Changelog",
    "Kaspersky",
    "Naked Security",
    "NCSC UK",
    "Risky Business",
    "Talos Intelligence",
    "The Cyber Wire",
    "Threatpost"
  ]);

  const preferredSourceNames = new Set([
    "Malwarebytes",
    "Dark Reading",
    "SecurityWeek",
    "The Hacker News",
    "ZDNet Security",
    "Palo Alto Unit42",
    "SANS ISC",
    "Medium Cybersecurity"
  ]);

  const usableSources = RSS_SOURCES.filter((source) => !blockedSourceNames.has(source.name));
  const preferredSources = usableSources.filter((source) => preferredSourceNames.has(source.name));
  const remainingSources = usableSources.filter((source) => !preferredSourceNames.has(source.name));

  // Prefer the sources that have been returning items reliably, then fill the rest with the broader pool.
  // Keep the total under Cloudflare's subrequest limit.
  const subset = [...preferredSources, ...remainingSources].slice(0, 15);

  const settled = await Promise.allSettled(
    subset.map((source) => fetchSingleSource(source))
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<RawFeedItem[]> => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((item) => Boolean(item.url && item.title));
};
