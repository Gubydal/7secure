import type { RawFeedItem, WorkerEnv } from "../types";

const SCRAPE_TIMEOUT_MS = 8_000;
const MAX_SCRAPED_LENGTH = 6_000;
const MIN_SCRAPED_LENGTH = 300;
const MAX_ARTICLES_TO_SCRAPE = 10;

// Blocklist of domains/paths that typically block scraping or serve paywalls
const SCRAPE_BLOCKLIST = [
  /\.pdf$/i,
  /youtube\.com/i,
  /youtu\.be/i,
  /twitter\.com/i,
  /x\.com/i,
  /facebook\.com/i,
  /linkedin\.com\/pulse/i,
];

const shouldSkipScraping = (url: string): boolean => {
  return SCRAPE_BLOCKLIST.some((pattern) => pattern.test(url));
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);?/g, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);?/g, (_match, dec: string) =>
      String.fromCharCode(Number.parseInt(dec, 10))
    );

const stripTags = (html: string): string =>
  decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Lines/patterns that are navigation/metadata, NOT article content
const JUNK_LINE_PATTERNS = [
  /^\s*\d+\s*min\s*read\s*$/i,
  /^\s*related\s+(products|articles|posts|stories)\s*$/i,
  /^\s*share\s+(this|on)\s*$/i,
  /^\s*follow\s+us\s*$/i,
  /^\s*subscribe\s*$/i,
  /^\s*categories?\s*[:\-]/i,
  /^\s*tags?\s*[:\-]/i,
  /^\s*author\s*[:\-]/i,
  /^\s*by\s*[:\-]?\s*\w+/i,
  /^\s*published\s*[:\-]/i,
  /^\s*updated\s*[:\-]/i,
  /^\s*source\s*[:\-]/i,
  /^\s*image\s*[:\-]/i,
  /^\s*photo\s*[:\-]/i,
  /^\s*advertisement\s*$/i,
  /^\s*sponsored\s*$/i,
  /^\s*read\s+more\s*$/i,
  /^\s*continue\s+reading\s*$/i,
  /^\s*you\s+may\s+also\s+like\s*$/i,
  /^\s*more\s+from\s+/i,
  /^\s*about\s+the\s+author\s*$/i,
  /^\s*editor's?\s+note\s*$/i,
  /^\s*disclaimer\s*$/i,
  /^\s*home\s*\/\s*/i,
  /^\s*\w+\s+\d{1,2},?\s+\d{4}\s*$/,
  /^\s*\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s*$/i,
];

const isJunkLine = (line: string): boolean => {
  return JUNK_LINE_PATTERNS.some((pattern) => pattern.test(line));
};

const cleanExtractedText = (text: string): string => {
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const cleaned: string[] = [];

  for (const line of lines) {
    // Skip junk lines
    if (isJunkLine(line)) continue;

    // Skip very short lines that are likely navigation
    if (line.length < 15 && !line.endsWith('.')) continue;

    // Skip lines that are just URLs
    if (/^https?:\/\//.test(line)) continue;

    // Skip lines that look like social media handles
    if (/^@\w+/.test(line)) continue;

    cleaned.push(line);
  }

  return cleaned.join("\n").trim();
};

const extractArticleText = (html: string, url: string): string => {
  // Try to find article content in common containers
  const articlePatterns = [
    /<article[\s\S]*?<\/article>/i,
    /<main[\s\S]*?<\/main>/i,
    /<div[^>]*class="[^"]*(?:article|post|entry|content|story|body)[^"]*"[\s\S]*?<\/div>/i,
    /<div[^>]*id="[^"]*(?:article|post|entry|content|story|body)[^"]*"[\s\S]*?<\/div>/i,
    /<section[^>]*class="[^"]*(?:article|post|entry|content|story)[^"]*"[\s\S]*?<\/section>/i,
  ];

  let bestText = "";
  let bestScore = 0;

  for (const pattern of articlePatterns) {
    const match = html.match(pattern);
    if (match) {
      const rawText = stripTags(match[0]);
      const text = cleanExtractedText(rawText);
      const score = scoreTextBlock(text);
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }
    }
  }

  // Fallback: extract all paragraphs and score them
  if (!bestText || bestText.length < MIN_SCRAPED_LENGTH) {
    const paragraphMatches = html.match(/<p[\s\S]*?<\/p>/gi) || [];
    const paragraphTexts = paragraphMatches.map((p) => cleanExtractedText(stripTags(p)));

    for (let i = 0; i < paragraphTexts.length; i++) {
      let block = paragraphTexts[i];
      for (let j = 1; j <= 4 && i + j < paragraphTexts.length; j++) {
        block += "\n" + paragraphTexts[i + j];
      }
      const score = scoreTextBlock(block);
      if (score > bestScore) {
        bestScore = score;
        bestText = block;
      }
    }
  }

  return bestText;
};

const scoreTextBlock = (text: string): number => {
  if (!text || text.length < MIN_SCRAPED_LENGTH) return 0;

  let score = text.length;

  // Reward sentences (indicates readable prose)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  score += sentences.length * 80;

  // Reward cybersecurity keywords
  const securityTerms = /\b(cyber|security|vulnerability|exploit|threat|attack|breach|malware|ransomware|phishing|CVE|zero-day|CISA|NIST|APT|hacker|incident|compromise|payload|backdoor|trojan|credential|token|OAuth|supply.chain)\b/gi;
  const termMatches = text.match(securityTerms);
  if (termMatches) {
    score += termMatches.length * 40;
  }

  // Reward specific technical details
  if (/\b(CVE-\d{4}-\d+|\d+\.\d+\.\d+|SHA-?256|MD5|IP address|port \d+|HTTP\/\d|TLS|SSL|VPN|firewall)\b/i.test(text)) {
    score += 150;
  }

  // Penalize if too much text looks like navigation
  const navLines = text.split('\n').filter((line) =>
    /\b(home|about|contact|privacy|terms|cookie|subscribe|newsletter|follow us|share this|read more|continue reading)\b/i.test(line)
  ).length;
  score -= navLines * 100;

  return Math.max(0, score);
};

export const scrapeArticle = async (
  item: RawFeedItem,
  _env: WorkerEnv
): Promise<string | null> => {
  if (shouldSkipScraping(item.url)) {
    console.log(`Skipping scrape for blocked URL: ${item.url}`);
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

    const response = await fetch(item.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Scrape failed for ${item.url}: HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      console.warn(`Scrape skipped for ${item.url}: non-HTML content (${contentType})`);
      return null;
    }

    const html = await response.text();
    if (!html || html.length < 500) {
      console.warn(`Scrape returned empty/short HTML for ${item.url}`);
      return null;
    }

    const articleText = extractArticleText(html, item.url);

    if (!articleText || articleText.length < MIN_SCRAPED_LENGTH) {
      console.warn(`Scrape extracted insufficient text from ${item.url}: ${articleText?.length || 0} chars`);
      return null;
    }

    const truncated = articleText.length > MAX_SCRAPED_LENGTH
      ? articleText.slice(0, MAX_SCRAPED_LENGTH).trim() + "..."
      : articleText;

    console.log(`Scraped ${truncated.length} clean chars from ${item.url}`);
    return truncated;

  } catch (error) {
    console.warn(`Scrape error for ${item.url}: ${(error as Error).message}`);
    return null;
  }
};

export const enrichArticlesWithScrapedContent = async (
  items: RawFeedItem[],
  env: WorkerEnv
): Promise<RawFeedItem[]> => {
  if (!items.length) return items;

  // Limit scraping to stay within Cloudflare subrequest limits
  const toScrape = items.slice(0, MAX_ARTICLES_TO_SCRAPE);
  const skipped = items.slice(MAX_ARTICLES_TO_SCRAPE);

  console.log(`Scraping ${toScrape.length} articles for full text (skipping ${skipped.length})...`);
  const enriched: RawFeedItem[] = [];

  // Process sequentially to be polite to target sites
  for (const item of toScrape) {
    const scraped = await scrapeArticle(item, env);
    if (scraped) {
      enriched.push({
        ...item,
        sourceSnippet: scraped,
        summary: item.summary || scraped.slice(0, 300).trim() + "..."
      });
    } else {
      enriched.push(item);
    }
  }

  // Add unscored items back without modification
  enriched.push(...skipped);

  const scrapedCount = enriched.filter((item) =>
    item.sourceSnippet && item.sourceSnippet.length > 500
  ).length;

  console.log(`Scraping complete: ${scrapedCount}/${items.length} articles enriched with full text`);
  return enriched;
};
