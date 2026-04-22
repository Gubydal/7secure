import { RSS_SOURCES } from "./sources";
import type { RawFeedItem, RSSSource, WorkerEnv } from "../types";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_ITEM_AGE_MS = 5 * 24 * 60 * 60 * 1000;

const BRAVE_API_BASE_URL = "https://api.search.brave.com/res/v1";
const BRAVE_NEWS_SEARCH_URL = `${BRAVE_API_BASE_URL}/news/search`;
const BRAVE_IMAGE_SEARCH_URL = `${BRAVE_API_BASE_URL}/images/search`;
const BRAVE_CATEGORY_BATCH_SIZE = 2;
const BRAVE_IMAGE_BATCH_SIZE = 4;
const MAX_BRAVE_IMAGE_ENRICHMENT = 16;
const DEFAULT_BRAVE_RESULTS_PER_QUERY = 12;
const MAX_BRAVE_RESULTS_PER_QUERY = 20;
const DEFAULT_BRAVE_FRESHNESS = "pw";

const RELIABLE_SOURCE_NAMES = new Set([
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

const CATEGORY_QUERY_HINTS: Record<string, string> = {
  "threat-intel": "cyber threat intelligence malware ransomware intrusion campaign",
  vulnerabilities: "vulnerability advisory CVE patch exploit remediation",
  "industry-news": "cybersecurity security operations incident response breach",
  research: "security research cryptography protocol analysis defensive study",
  "ai-security": "AI security model safety prompt injection model vulnerabilities",
  government: "cybersecurity government advisory CERT CISA NIST guidance"
};

interface BraveNewsResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
  published?: string;
  extra_snippets?: string[];
  profile?: {
    name?: string;
    url?: string;
    img?: string;
  };
  thumbnail?: {
    src?: string;
    url?: string;
    original?: string;
  };
  meta?: Record<string, unknown>;
}

interface BraveNewsSearchResponse {
  results?: BraveNewsResult[];
  news?: {
    results?: BraveNewsResult[];
  };
}

interface BraveImageResult {
  url?: string;
  source?: string;
  thumbnail?: {
    src?: string;
    url?: string;
    original?: string;
  };
  properties?: {
    url?: string;
    thumbnail?: string;
  };
  image?: {
    url?: string;
  };
}

interface BraveImageSearchResponse {
  results?: BraveImageResult[];
  images?: {
    results?: BraveImageResult[];
  };
}

interface BraveCategoryQuery {
  category: string;
  query: string;
  sourceByHostname: Map<string, RSSSource>;
}

const asString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);?/g, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);?/g, (_match, dec: string) =>
      String.fromCharCode(Number.parseInt(dec, 10))
    );

const stripMarkup = (value: string): string =>
  decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/^www\./, "").trim();

const getHostname = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return "";
  }
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

const parseRelativeAge = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "yesterday") {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  const match = normalized.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  const multipliers: Record<string, number> = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    return null;
  }

  return new Date(Date.now() - amount * multiplier).toISOString();
};

const toIsoDate = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) {
    return null;
  }

  const direct = Date.parse(text);
  if (!Number.isNaN(direct)) {
    return new Date(direct).toISOString();
  }

  return parseRelativeAge(text);
};

const isLikelyImageUrl = (value: string): boolean => {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  if (/imgs\.search\.brave\.com/i.test(value)) {
    return true;
  }

  return /\.(avif|webp|png|jpe?g|gif|bmp|svg)(\?|$)/i.test(value);
};

const pickFirstImageUrl = (candidates: Array<string | null | undefined>): string | null => {
  for (const candidate of candidates) {
    const normalized = normalizeArticleUrl(candidate || "");
    if (normalized && isLikelyImageUrl(normalized)) {
      return normalized;
    }
  }
  return null;
};

const parseResultCount = (env: WorkerEnv): number => {
  const raw = asString(env.BRAVE_SEARCH_RESULTS_PER_QUERY);
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_BRAVE_RESULTS_PER_QUERY;
  }
  return Math.min(MAX_BRAVE_RESULTS_PER_QUERY, Math.max(5, parsed));
};

const parseFreshness = (env: WorkerEnv): string => {
  const raw = asString(env.BRAVE_SEARCH_FRESHNESS).toLowerCase();
  if (!raw) {
    return DEFAULT_BRAVE_FRESHNESS;
  }

  if (["pd", "pw", "pm", "py"].includes(raw)) {
    return raw;
  }

  const isCustomRange = /^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/i.test(raw);
  return isCustomRange ? raw : DEFAULT_BRAVE_FRESHNESS;
};

const buildBraveSourcePool = (): RSSSource[] => {
  const reliable = RSS_SOURCES.filter((source) => RELIABLE_SOURCE_NAMES.has(source.name));
  const coveredCategories = new Set(reliable.map((source) => source.category));

  for (const source of RSS_SOURCES) {
    if (!coveredCategories.has(source.category)) {
      reliable.push(source);
      coveredCategories.add(source.category);
    }
  }

  return reliable;
};

const buildCategoryQueries = (): BraveCategoryQuery[] => {
  const grouped = new Map<string, RSSSource[]>();

  for (const source of buildBraveSourcePool()) {
    const existing = grouped.get(source.category) || [];
    existing.push(source);
    grouped.set(source.category, existing);
  }

  const queries: BraveCategoryQuery[] = [];

  for (const [category, sources] of grouped.entries()) {
    const sourceByHostname = new Map<string, RSSSource>();
    for (const source of sources) {
      const hostname = getHostname(source.url);
      if (!hostname || sourceByHostname.has(hostname)) {
        continue;
      }
      sourceByHostname.set(hostname, source);
    }

    const hostnames = [...sourceByHostname.keys()].slice(0, 8);
    if (!hostnames.length) {
      continue;
    }

    const siteClause =
      hostnames.length === 1
        ? `site:${hostnames[0]}`
        : `(${hostnames.map((hostname) => `site:${hostname}`).join(" OR ")})`;
    const queryPrefix = CATEGORY_QUERY_HINTS[category] || "cybersecurity security advisory";

    queries.push({
      category,
      query: `${queryPrefix} ${siteClause}`,
      sourceByHostname
    });
  }

  return queries;
};

const buildCommonBraveParams = (env: WorkerEnv, query: string): URLSearchParams => {
  const params = new URLSearchParams({ q: query });

  const country = asString(env.BRAVE_SEARCH_COUNTRY).toLowerCase();
  const searchLang = asString(env.BRAVE_SEARCH_LANG).toLowerCase();

  if (country) {
    params.set("country", country);
  }
  if (searchLang) {
    params.set("search_lang", searchLang);
  }

  return params;
};

const buildNewsSearchParams = (
  env: WorkerEnv,
  query: string,
  count: number
): URLSearchParams => {
  const params = buildCommonBraveParams(env, query);
  params.set("count", String(count));
  params.set("freshness", parseFreshness(env));
  params.set("extra_snippets", "true");
  params.set("safesearch", "moderate");
  return params;
};

const buildImageSearchParams = (env: WorkerEnv, query: string): URLSearchParams => {
  const params = buildCommonBraveParams(env, query);
  params.set("count", "1");
  params.set("safesearch", "moderate");
  return params;
};

const callBraveApi = async <T>(
  env: WorkerEnv,
  endpoint: string,
  params: URLSearchParams
): Promise<T | null> => {
  const subscriptionToken = asString(env.BRAVE_SEARCH_API_KEY);
  if (!subscriptionToken) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": subscriptionToken
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Brave API error ${response.status} for ${endpoint}: ${errorBody.slice(0, 240)}`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Brave API request failed for ${endpoint}: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const resolvePublishedAt = (result: BraveNewsResult): string => {
  const metaPublished = asString(result.meta?.published);
  const metaDate = asString(result.meta?.date);
  const isoCandidate =
    toIsoDate(result.published) ||
    toIsoDate(result.page_age) ||
    toIsoDate(result.age) ||
    toIsoDate(metaPublished) ||
    toIsoDate(metaDate);

  if (!isoCandidate) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(isoCandidate);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }

  if (Date.now() - parsed > MAX_ITEM_AGE_MS) {
    return new Date().toISOString();
  }

  return isoCandidate;
};

const pickNewsResultImage = (result: BraveNewsResult): string | null =>
  pickFirstImageUrl([
    result.thumbnail?.src,
    result.thumbnail?.url,
    result.thumbnail?.original,
    result.profile?.img
  ]);

const mapNewsResultToRawItem = (
  result: BraveNewsResult,
  categoryQuery: BraveCategoryQuery
): RawFeedItem | null => {
  const title = stripMarkup(asString(result.title));
  const url = normalizeArticleUrl(asString(result.url));

  if (!title || !url) {
    return null;
  }

  const description = stripMarkup(asString(result.description));
  const extraSnippets = (result.extra_snippets || [])
    .map((snippet) => stripMarkup(asString(snippet)))
    .filter(Boolean);

  const hostname = getHostname(url);
  const knownSource = hostname ? categoryQuery.sourceByHostname.get(hostname) : undefined;
  const sourceName =
    knownSource?.name ||
    stripMarkup(asString(result.profile?.name)) ||
    hostname ||
    "Unknown source";

  const sourceUrl =
    normalizeArticleUrl(asString(result.profile?.url)) ||
    (hostname ? `https://${hostname}/` : knownSource?.url || url);

  const summary =
    description ||
    extraSnippets[0] ||
    `${title} - read the full report from ${sourceName}.`;
  const sourceSnippet = [description, ...extraSnippets].join(" ").slice(0, 4200) || undefined;

  return {
    title,
    url,
    summary,
    sourceSnippet,
    publishedAt: resolvePublishedAt(result),
    sourceName,
    sourceUrl,
    category: categoryQuery.category,
    imageUrl: pickNewsResultImage(result)
  };
};

const fetchBraveCategoryNews = async (
  env: WorkerEnv,
  categoryQuery: BraveCategoryQuery,
  resultCount: number
): Promise<RawFeedItem[]> => {
  const params = buildNewsSearchParams(env, categoryQuery.query, resultCount);
  const payload = await callBraveApi<BraveNewsSearchResponse>(
    env,
    BRAVE_NEWS_SEARCH_URL,
    params
  );
  const results = payload?.news?.results || payload?.results || [];

  const mapped = results
    .map((result) => mapNewsResultToRawItem(result, categoryQuery))
    .filter((item): item is RawFeedItem => Boolean(item));

  console.log(
    `Brave news search category ${categoryQuery.category}: ${mapped.length} mapped result(s)`
  );

  return mapped;
};

const pickImageFromImageResult = (result: BraveImageResult): string | null =>
  pickFirstImageUrl([
    result.thumbnail?.src,
    result.thumbnail?.url,
    result.thumbnail?.original,
    result.properties?.url,
    result.properties?.thumbnail,
    result.image?.url,
    result.source,
    result.url
  ]);

const fetchBraveImageForItem = async (
  env: WorkerEnv,
  item: RawFeedItem
): Promise<string | null> => {
  const hostname = getHostname(item.url);
  const imageQuery = hostname ? `${item.title} site:${hostname}` : item.title;
  const params = buildImageSearchParams(env, imageQuery);

  const payload = await callBraveApi<BraveImageSearchResponse>(
    env,
    BRAVE_IMAGE_SEARCH_URL,
    params
  );

  const imageResults = payload?.images?.results || payload?.results || [];
  for (const result of imageResults) {
    const imageUrl = pickImageFromImageResult(result);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return null;
};

const enrichMissingImagesWithBrave = async (
  env: WorkerEnv,
  items: RawFeedItem[]
): Promise<void> => {
  const candidates = items
    .filter((item) => !item.imageUrl)
    .slice(0, MAX_BRAVE_IMAGE_ENRICHMENT);

  if (!candidates.length) {
    return;
  }

  for (let index = 0; index < candidates.length; index += BRAVE_IMAGE_BATCH_SIZE) {
    const batch = candidates.slice(index, index + BRAVE_IMAGE_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((item) => fetchBraveImageForItem(env, item))
    );

    settled.forEach((result, position) => {
      if (result.status === "fulfilled" && result.value) {
        batch[position].imageUrl = result.value;
      }
    });

    console.log(
      `Brave image enrichment batch ${Math.floor(index / BRAVE_IMAGE_BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BRAVE_IMAGE_BATCH_SIZE)} complete`
    );
  }
};

export const fetchFeeds = async (env: WorkerEnv): Promise<RawFeedItem[]> => {
  const braveKey = asString(env.BRAVE_SEARCH_API_KEY);
  if (!braveKey) {
    console.error("BRAVE_SEARCH_API_KEY is missing. Brave-only mode prevents fetching.");
    return [];
  }

  const categoryQueries = buildCategoryQueries();
  const resultCount = parseResultCount(env);
  const collected: RawFeedItem[] = [];

  console.log(
    `Fetching Brave news across ${categoryQueries.length} category query(ies), count=${resultCount}`
  );

  for (
    let index = 0;
    index < categoryQueries.length;
    index += BRAVE_CATEGORY_BATCH_SIZE
  ) {
    const batch = categoryQueries.slice(index, index + BRAVE_CATEGORY_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((query) => fetchBraveCategoryNews(env, query, resultCount))
    );

    const batchItems = settled
      .filter(
        (result): result is PromiseFulfilledResult<RawFeedItem[]> =>
          result.status === "fulfilled"
      )
      .flatMap((result) => result.value)
      .filter((item) => Boolean(item.url && item.title));

    collected.push(...batchItems);

    console.log(
      `Brave news batch ${Math.floor(index / BRAVE_CATEGORY_BATCH_SIZE) + 1}/${Math.ceil(categoryQueries.length / BRAVE_CATEGORY_BATCH_SIZE)} complete: +${batchItems.length} items`
    );
  }

  const dedupedByUrl = new Map<string, RawFeedItem>();
  for (const item of collected) {
    if (!dedupedByUrl.has(item.url)) {
      dedupedByUrl.set(item.url, item);
    }
  }

  const deduped = [...dedupedByUrl.values()];
  if (!deduped.length) {
    console.warn("Brave news fetch returned no items. Skipping fetch by request.");
    return [];
  }

  await enrichMissingImagesWithBrave(env, deduped);

  console.log(
    `Brave fetch complete: ${deduped.length} unique items (${deduped.filter((item) => item.imageUrl).length} with images)`
  );

  return deduped.slice(0, 60);
};
