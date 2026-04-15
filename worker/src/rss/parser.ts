import type { RawFeedItem, RSSSource } from "../types";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

const safeText = (el: Element | null | undefined): string =>
  (el?.textContent ?? "").trim();

const parseDate = (value: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  if (Date.now() - parsed > TWO_DAYS_MS) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const parseRssItems = (doc: Document, source: RSSSource): RawFeedItem[] => {
  const channel = doc.querySelector("channel");
  const sourceUrl = safeText(channel?.querySelector("link")) || source.url;
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 20);

  const parsed: RawFeedItem[] = [];
  for (const item of items) {
    const title = safeText(item.querySelector("title"));
    const url = safeText(item.querySelector("link"));
    const summary =
      safeText(item.querySelector("description")) ||
      safeText(item.querySelector("content\\:encoded"));
    const publishedAt = parseDate(safeText(item.querySelector("pubDate")));

    if (!title || !url || !summary || !publishedAt) {
      continue;
    }

    parsed.push({
      title,
      url,
      summary,
      publishedAt,
      sourceName: source.name,
      sourceUrl,
      category: source.category
    });

    if (parsed.length >= 5) {
      break;
    }
  }

  return parsed;
};

const parseAtomItems = (doc: Document, source: RSSSource): RawFeedItem[] => {
  const feed = doc.querySelector("feed");
  const sourceUrl =
    feed?.querySelector("link[rel='alternate']")?.getAttribute("href") ||
    feed?.querySelector("link")?.getAttribute("href") ||
    source.url;

  const entries = Array.from(doc.querySelectorAll("entry")).slice(0, 20);
  const parsed: RawFeedItem[] = [];

  for (const entry of entries) {
    const title = safeText(entry.querySelector("title"));
    const url =
      entry.querySelector("link[rel='alternate']")?.getAttribute("href") ||
      entry.querySelector("link")?.getAttribute("href") ||
      "";
    const summary =
      safeText(entry.querySelector("summary")) ||
      safeText(entry.querySelector("content"));
    const publishedAt = parseDate(
      safeText(entry.querySelector("updated")) ||
        safeText(entry.querySelector("published"))
    );

    if (!title || !url || !summary || !publishedAt) {
      continue;
    }

    parsed.push({
      title,
      url,
      summary,
      publishedAt,
      sourceName: source.name,
      sourceUrl,
      category: source.category
    });

    if (parsed.length >= 5) {
      break;
    }
  }

  return parsed;
};

export const parseFeedXml = (xml: string, source: RSSSource): RawFeedItem[] => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return [];
  }

  if (doc.querySelector("rss channel item")) {
    return parseRssItems(doc, source);
  }

  if (doc.querySelector("feed entry")) {
    return parseAtomItems(doc, source);
  }

  return [];
};
