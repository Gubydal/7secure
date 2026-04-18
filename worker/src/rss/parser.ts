import { XMLParser } from "fast-xml-parser";
import type { RawFeedItem, RSSSource } from "../types";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

const safeText = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && val["#text"]) return val["#text"].trim();
  return String(val).trim();
};

const pickDirectUrl = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : "";
  }
  if (Array.isArray(value)) return pickDirectUrl(value[0]);
  if (typeof value === "object") {
    return (
      safeText(value["@_url"]) ||
      safeText(value["@_href"]) ||
      pickDirectUrl(value.url) ||
      pickDirectUrl(value.href) ||
      pickDirectUrl(value.src)
    );
  }
  return "";
};

const extractImageUrlFromMarkup = (markup: string): string => {
  const match = markup.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || "";
};

const extractImageUrl = (...candidates: any[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const fromMarkup = extractImageUrlFromMarkup(candidate);
      if (fromMarkup) return fromMarkup;

      const direct = pickDirectUrl(candidate);
      if (direct) return direct;
      continue;
    }

    const direct = pickDirectUrl(candidate);
    if (direct) return direct;

    if (candidate && typeof candidate === "object") {
      const nested = pickDirectUrl(candidate.url) || pickDirectUrl(candidate.href) || pickDirectUrl(candidate.src);
      if (nested) return nested;

      const markup = safeText(candidate["#text"]) || safeText(candidate.description) || safeText(candidate.content);
      const fromMarkup = extractImageUrlFromMarkup(markup);
      if (fromMarkup) return fromMarkup;
    }
  }

  return null;
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const stripMarkup = (value: string): string =>
  decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseDate = (value: any): string | null => {
  const str = safeText(value);
  if (!str) return null;
  const parsed = Date.parse(str);
  if (Number.isNaN(parsed)) return null;
  if (Date.now() - parsed > TWO_DAYS_MS) return null;
  return new Date(parsed).toISOString();
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

export const parseFeedXml = (xml: string, source: RSSSource): RawFeedItem[] => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
      attributeNamePrefix: "@_"
    });
    const parsedXml = parser.parse(xml);

    const parsed: RawFeedItem[] = [];

    // Check for RSS pattern
    if (parsedXml?.rss?.channel?.item) {
      let items = parsedXml.rss.channel.item;
      if (!Array.isArray(items)) items = [items];
      const sourceUrl = safeText(parsedXml.rss.channel.link) || source.url;

      for (const item of items.slice(0, 20)) {
        const title = safeText(item.title);
        const url = normalizeArticleUrl(safeText(item.link));
        const rawDescription = safeText(item.description);
        const rawEncoded = safeText(item["content:encoded"]) || safeText(item.content);
        const plainDescription = stripMarkup(rawDescription);
        const plainEncoded = stripMarkup(rawEncoded);
        const summary =
          plainDescription ||
          plainEncoded ||
          `${title} - read the full report from ${source.name}.`;
        const sourceSnippet = (plainEncoded || plainDescription || summary).slice(0, 4200);
        const publishedAt = parseDate(item.pubDate);
        const imageUrl = extractImageUrl(
          item["media:content"],
          item["media:thumbnail"],
          item.enclosure,
          item.image,
          item.thumbnail,
          item.description,
          item["content:encoded"]
        );

        if (!title || !url || !publishedAt) continue;

        parsed.push({
          title,
          url,
          summary,
          sourceSnippet,
          publishedAt,
          sourceName: source.name,
          sourceUrl,
          category: source.category,
          imageUrl
        });

        if (parsed.length >= 5) break;
      }
      return parsed;
    }

    // Check for ATOM pattern
    if (parsedXml?.feed?.entry) {
      let entries = parsedXml.feed.entry;
      if (!Array.isArray(entries)) entries = [entries];
      
      const feedLinks = Array.isArray(parsedXml.feed.link) ? parsedXml.feed.link : [parsedXml.feed.link];
      const altLink = feedLinks.find((l: any) => l && l["@_rel"] === "alternate");
      const sourceUrl = altLink ? altLink["@_href"] : (feedLinks[0] ? feedLinks[0]["@_href"] : source.url);

      for (const entry of entries.slice(0, 20)) {
        const title = safeText(entry.title);
        
        let entryLinks = Array.isArray(entry.link) ? entry.link : [entry.link];
        const entryAlt = entryLinks.find((l: any) => l && l["@_rel"] === "alternate");
        const url = normalizeArticleUrl(
          entryAlt ? entryAlt["@_href"] : (entryLinks[0] ? entryLinks[0]["@_href"] : "")
        );
        
        const rawSummary = safeText(entry.summary);
        const rawContent = safeText(entry.content);
        const plainSummary = stripMarkup(rawSummary);
        const plainContent = stripMarkup(rawContent);
        const summary =
          plainSummary ||
          plainContent ||
          `${title} - read the full report from ${source.name}.`;
        const sourceSnippet = (plainContent || plainSummary || summary).slice(0, 4200);
        const publishedAt = parseDate(entry.updated) || parseDate(entry.published);
        const imageUrl = extractImageUrl(
          entry["media:content"],
          entry["media:thumbnail"],
          entry.enclosure,
          entry.image,
          entry.thumbnail,
          entry.content,
          entry.summary
        );

        if (!title || !url || !publishedAt) continue;

        parsed.push({
          title,
          url,
          summary,
          sourceSnippet,
          publishedAt,
          sourceName: source.name,
          sourceUrl,
          category: source.category,
          imageUrl
        });

        if (parsed.length >= 5) break;
      }
      return parsed;
    }

    return parsed;
  } catch (error) {
    console.error("XML Parsing Error for", source.url, (error as Error).message);
    return [];
  }
};
