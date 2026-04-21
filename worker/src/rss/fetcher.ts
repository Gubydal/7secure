import { parseFeedXml } from "./parser";
import { RSS_SOURCES } from "./sources";
import type { RawFeedItem, RSSSource } from "../types";

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_MAX_ATTEMPTS = 2;
const FEED_BATCH_SIZE = 6;

const DEFAULT_FEED_HEADERS: HeadersInit = {
  "User-Agent": "7secure-feed-bot/1.0 (+https://7secure.pages.dev)",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

const BROWSER_FEED_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.google.com/"
};

const fetchSingleSource = async (source: RSSSource): Promise<RawFeedItem[]> => {
  const attempts = [DEFAULT_FEED_HEADERS, BROWSER_FEED_HEADERS];

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: attempts[attempt - 1] || BROWSER_FEED_HEADERS,
        redirect: "follow"
      });

      if (!response.ok) {
        const shouldRetry = attempt < FETCH_MAX_ATTEMPTS && (response.status === 403 || response.status === 429 || response.status >= 500);
        console.error(`Failed to fetch ${source.url}: HTTP ${response.status} (attempt ${attempt}/${FETCH_MAX_ATTEMPTS})`);

        if (shouldRetry) {
          continue;
        }

        return [];
      }

      const xml = await response.text();
      const parsed = parseFeedXml(xml, source);
      console.log(`Successfully parsed ${parsed.length} items from ${source.url}`);
      return parsed;
    } catch (error) {
      const message = (error as Error).message;
      const canRetry = attempt < FETCH_MAX_ATTEMPTS;
      console.error(`Error fetching/parsing ${source.url} (attempt ${attempt}/${FETCH_MAX_ATTEMPTS}): ${message}`);

      if (!canRetry) {
        return [];
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return [];
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
    "OpenAI Blog",
    "Google Research",
    "NIST CSRC",
    "CISA Alerts",
    "Microsoft Security"
  ]);

  // Keep the worker focused on sources that are actually returning usable items.
  // This avoids wasting subrequests on feeds that routinely 404, rate-limit, or emit invalid XML.
  const subset = RSS_SOURCES
    .filter((source) => reliableSourceNames.has(source.name))
    .slice(0, 20);

  console.log(`Fetching ${subset.length} curated RSS sources`);

  const collected: RawFeedItem[] = [];
  for (let index = 0; index < subset.length; index += FEED_BATCH_SIZE) {
    const batch = subset.slice(index, index + FEED_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((source) => fetchSingleSource(source)));

    const parsedItems = settled
      .filter((result): result is PromiseFulfilledResult<RawFeedItem[]> => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((item) => Boolean(item.url && item.title));

    collected.push(...parsedItems);
    console.log(
      `Feed batch ${Math.floor(index / FEED_BATCH_SIZE) + 1}/${Math.ceil(subset.length / FEED_BATCH_SIZE)} complete: +${parsedItems.length} items`
    );
  }

  return collected;
};
