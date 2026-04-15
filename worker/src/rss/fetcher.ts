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
        "User-Agent": "7secure-worker/1.0"
      }
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseFeedXml(xml, source);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchFeeds = async (): Promise<RawFeedItem[]> => {
  const settled = await Promise.allSettled(
    RSS_SOURCES.map((source) => fetchSingleSource(source))
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<RawFeedItem[]> => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((item) => Boolean(item.url && item.title));
};
