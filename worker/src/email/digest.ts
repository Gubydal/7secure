import { Resend } from "resend";
import {
  getRecentArticles,
  getSentArticleSlugs,
  getSubscribers,
  markDigestArticlesSent,
  getAuthors
} from "../db/supabase";
import type { WorkerEnv, ArticleSnippet } from "../types";

export interface DigestSendResult {
  articleCount: number;
  subscriberCount: number;
  status: "success" | "failed";
}

interface DigestArticle {
  title: string;
  slug: string;
  summary: string;
  content?: string;
  category: string;
  published_at: string;
  original_url?: string;
  image_url?: string | null;
  is_incident?: boolean;
}

interface DigestSubscriber {
  email: string;
  role?: string | null;
}

const ARTICLE_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u200D]/gu;

const stripEmojiInline = (value: string): string => value.replace(ARTICLE_EMOJI_REGEX, "").replace(/\s+/g, " ").trim();

const clamp = (value: string, limit: number): string =>
  value.length > limit ? `${value.slice(0, limit - 3).trimEnd()}...` : value;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toSiteBase = (siteUrl: string): string => siteUrl.replace(/\/$/, "");

const safeUrl = (value: string | null | undefined, fallback: string): string => {
  const candidate = (value || "").trim();
  if (!candidate) return fallback;
  try { return new URL(candidate).toString(); } catch { return fallback; }
};

const resolveImageUrl = (imageUrl: string | null | undefined, siteBase: string): string | null => {
  const raw = (imageUrl || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${siteBase}${raw}`;
  return null;
};

const displayNameFromSubscriber = (subscriber: DigestSubscriber): string => {
  const role = (subscriber.role || "").trim();
  if (role) return role.split(/\s+/)[0];
  const localPart = subscriber.email.split("@")[0] || "there";
  const cleaned = localPart.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const first = cleaned.split(/\s+/)[0] || "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
};

const extractSection = (content: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
};

const extractMetadata = (content: string) => {
  const severity = content.match(/\*\*Severity:\*\*\s*(.+)/i)?.[1]?.trim() || "Medium";
  const sectors = content.match(/\*\*Affected Sectors:\*\*\s*(.+)/i)?.[1]?.trim() || "General";
  const threatType = content.match(/\*\*Threat Type:\*\*\s*(.+)/i)?.[1]?.trim() || "";
  const attribution = content.match(/\*\*Attribution:\*\*\s*(.+)/i)?.[1]?.trim() || "Unknown";
  return { severity, sectors, threatType, attribution };
};

const severityColor = (severity: string): string => {
  const s = severity.toLowerCase();
  if (s.includes("critical")) return "#ef4444";
  if (s.includes("high")) return "#f97316";
  if (s.includes("medium")) return "#eab308";
  return "#22c55e";
};

const buildArticleBody = (content: string): string => {
  const keyPoints = extractSection(content, [
    /##\s*Key\s*Takeaways?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const whatHappened = extractSection(content, [
    /##\s*What\s*Happened\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const whyItMatters = extractSection(content, [
    /##\s*Why\s*It\s*Matters?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const securityImplications = extractSection(content, [
    /##\s*Security\s*Implications?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);
  const recommendedMitigations = extractSection(content, [
    /##\s*Recommended\s*Mitigations?\s*\n([\s\S]*?)(?=\n##|$)/i
  ]);

  const clean = (text: string) => {
    const t = text.replace(/[\[\]]/g, "").trim();
    return t.length > 5 ? escapeHtml(stripEmojiInline(t)) : "";
  };

  const bulletsToHtml = (md: string): string => {
    const items = md.split('\n').filter(l => l.trim().startsWith('-'));
    if (!items.length) return md ? `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};">${escapeHtml(stripEmojiInline(md))}</p>` : "";
    return `<ul style="margin:10px 0 0 0;padding:0;list-style:none;">${items.map(item => `<li style="margin-bottom:8px;padding-left:20px;position:relative;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};"><span style="position:absolute;left:0;color:${ACCENT};">→</span>${escapeHtml(item.replace(/^- /, '').trim())}</li>`).join('')}</ul>`;
  };

  const sectionHtml = (emoji: string, label: string, body: string, isBullets = false) => {
    if (!body) return "";
    const htmlBody = isBullets ? bulletsToHtml(body) : `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};">${clean(body)}</p>`;
    return `<div style="margin:18px 0 0 0;"><strong style="font-size:14px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">${emoji} ${label}</strong>${htmlBody}</div>`;
  };

  return [
    sectionHtml("🔑", "Key Takeaways", keyPoints, true),
    sectionHtml("📖", "What Happened", whatHappened),
    sectionHtml("💡", "Why It Matters", whyItMatters),
    sectionHtml("🎯", "Security Implications", securityImplications),
    sectionHtml("🛡️", "Recommended Mitigations", recommendedMitigations, true)
  ].filter(Boolean).join("");
};

const humanizeCategory = (category: string): string => category.replace(/-/g, " ");

const formatPublishDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toUTCString().slice(5, 16);
};

const serializeError = (error: unknown): string => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try { return JSON.stringify(error); } catch { return String(error); }
};

const pickDigestArticles = (articles: DigestArticle[]): DigestArticle[] => {
  const picks: DigestArticle[] = [];
  const byCategory = (category: string) =>
    articles.filter((a) => a.category === category).slice(0, 2);

  picks.push(...byCategory("threat-intel"));
  picks.push(...byCategory("industry-news"));
  picks.push(...byCategory("vulnerabilities"));

  const aiOrResearch = articles
    .filter((a) => ["ai-security", "research"].includes(a.category))
    .slice(0, 2);
  picks.push(...aiOrResearch);

  const unique = new Map<string, DigestArticle>();
  for (const article of picks) unique.set(article.slug, article);

  if (unique.size < 8) {
    for (const article of articles) {
      unique.set(article.slug, article);
      if (unique.size >= 8) break;
    }
  }

  return [...unique.values()].slice(0, 8);
};

// ─── Design Tokens ──────────────────────────────────────────────
const DARK_BG = "#0a0a0f";
const BORDER_COLOR = "#2a2a3a";
const TEXT_PRIMARY = "#e2e2ea";
const TEXT_SECONDARY = "#9ca3af";
const ACCENT = "#3b82f6";
const TITLE_BLUE = "#60a5fa";

const sectionSpacer = `<tr><td style="padding:0;height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

const buildDailyRundownList = (articles: DigestArticle[]): string =>
  articles
    .map((article) => {
      return `<li style="margin:0 0 14px 0;color:${TEXT_SECONDARY};"><strong style="font-size:16px;color:${TITLE_BLUE};font-weight:700;">${escapeHtml(stripEmojiInline(article.title))}</strong><br/><span style="font-size:14px;color:${TEXT_SECONDARY};line-height:1.5;">${escapeHtml(clamp(stripEmojiInline(article.summary), 120))}</span></li>`;
    })
    .join("");

const buildLatestDevelopmentCards = (articles: DigestArticle[], siteBase: string): string =>
  articles
    .map((article, index) => {
      const newsletterHref = `${siteBase}/articles/${article.slug}`;
      const originalHref = safeUrl(article.original_url, newsletterHref);
      const imageSrc = resolveImageUrl(article.image_url, siteBase);
      const category = escapeHtml(humanizeCategory(article.category).toUpperCase());
      const title = escapeHtml(stripEmojiInline(article.title));
      const meta = extractMetadata(article.content || "");
      const bodyHtml = buildArticleBody(article.content || "");

      const imageBlock = imageSrc
        ? `<img src="${imageSrc}" alt="${title}" width="100%" style="display:block;width:100%;height:auto;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:16px;" />`
        : "";

      const metadataBlock = meta.threatType
        ? `<div style="margin:0 0 14px 0;">
            <span style="display:inline-block;background:${severityColor(meta.severity)}20;color:${severityColor(meta.severity)};font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;margin-right:6px;border:1px solid ${severityColor(meta.severity)}40;">${escapeHtml(meta.severity)}</span>
            <span style="display:inline-block;background:#1e293b;color:${TEXT_SECONDARY};font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;margin-right:6px;border:1px solid ${BORDER_COLOR};">${escapeHtml(meta.threatType)}</span>
            <span style="display:inline-block;background:#1e293b;color:${TEXT_SECONDARY};font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;border:1px solid ${BORDER_COLOR};">${escapeHtml(meta.attribution)}</span>
          </div>`
        : "";

      const divider = index > 0 ? `<tr><td style="padding:0;"><div style="height:1px;background:${BORDER_COLOR};margin:0 24px;"></div></td></tr>${sectionSpacer}` : "";

      return `${divider}
      <tr>
        <td style="padding:24px;font-family:Arial,sans-serif;color:${TEXT_PRIMARY};">
          ${imageBlock}
          <a href="${originalHref}" style="font-size:24px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};text-decoration:none;display:block;font-family:Arial,sans-serif;">${title}</a>
          ${bodyHtml}
          <p style="margin:18px 0 0 0;font-size:13px;line-height:1.5;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;"><strong style="color:${TEXT_PRIMARY};">7secure</strong> · ${formatPublishDate(article.published_at)} · <a href="${newsletterHref}" style="color:${ACCENT};text-decoration:underline;font-weight:600;">Read full version →</a></p>
        </td>
      </tr>`;
    })
    .join("");

const buildRatingSection = (subscriberEmail: string, siteBase: string): string => {
  const encodedEmail = encodeURIComponent(subscriberEmail);
  const feedbackLink = (rating: number): string =>
    `${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=${rating}&context=daily_digest_email`;

  return `
  <tr>
    <td style="padding:24px;font-family:Arial,sans-serif;">
      <div style="font-size:22px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};margin-bottom:8px;font-family:Arial,sans-serif;">That's it for today!</div>
      <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">Rate today's briefing so we can keep improving your daily security intelligence.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 10px 0;"><a href="${feedbackLink(5)}" style="display:block;background:#1e293b;border:1px solid ${BORDER_COLOR};border-radius:8px;padding:14px 16px;color:${TEXT_PRIMARY};text-decoration:none;font-size:18px;font-weight:700;font-family:Arial,sans-serif;">🛡️🛡️🛡️🛡️🛡️ Nailed it</a></td>
        </tr>
        <tr>
          <td style="padding:0 0 10px 0;"><a href="${feedbackLink(3)}" style="display:block;background:#1e293b;border:1px solid ${BORDER_COLOR};border-radius:8px;padding:14px 16px;color:${TEXT_SECONDARY};text-decoration:none;font-size:18px;font-weight:700;font-family:Arial,sans-serif;">🛡️🛡️🛡️ Average</a></td>
        </tr>
        <tr>
          <td style="padding:0;"><a href="${feedbackLink(1)}" style="display:block;background:#1e293b;border:1px solid ${BORDER_COLOR};border-radius:8px;padding:14px 16px;color:${TEXT_SECONDARY};text-decoration:none;font-size:18px;font-weight:700;font-family:Arial,sans-serif;">🛡️ Needs work</a></td>
        </tr>
      </table>
    </td>
  </tr>`;
};

const buildAuthorSection = (siteBase: string, authors: Array<{ name: string; image_url?: string | null }>): string => {
  const authorItems = authors.map((author) => {
    const img = author.image_url
      ? `<img src="${author.image_url}" alt="${escapeHtml(author.name)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};" />`
      : `<img src="${siteBase}/7secure_logo.svg" alt="7secure" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};background:#ffffff;padding:4px;" />`;
    return `<td style="padding:0 12px 0 0;text-align:center;">${img}<p style="margin:6px 0 0 0;font-size:13px;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${escapeHtml(author.name)}</p></td>`;
  }).join("");

  return `
  <tr>
    <td style="padding:24px;font-family:Arial,sans-serif;">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${TEXT_SECONDARY};margin-bottom:12px;font-family:Arial,sans-serif;">Curated by</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          ${authorItems}
        </tr>
      </table>
    </td>
  </tr>`;
};

const buildHtmlDigest = (
  articles: DigestArticle[],
  subscriber: DigestSubscriber,
  siteUrl: string,
  newsletterTitle: string,
  snippets: ArticleSnippet[],
  authors: Array<{ name: string; image_url?: string | null }> = [],
  threatPulse: string = ""
): string => {
  const siteBase = toSiteBase(siteUrl);
  const date = new Date().toUTCString().slice(5, 16);
  const subscriberName = escapeHtml(displayNameFromSubscriber(subscriber));
  const unsubscribeUrl = `${siteBase}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
  const coverImage = `${siteBase}/cover.avif`;
  const dailyRundownList = buildDailyRundownList(articles);
  const latestDevelopmentCards = buildLatestDevelopmentCards(articles, siteBase);
  const ratingSection = buildRatingSection(subscriber.email, siteBase);
  const authorSection = authors.length > 0 ? buildAuthorSection(siteBase, authors) : "";

  const threatPulseBlock = threatPulse
    ? `<tr>
        <td style="padding:24px;font-family:Arial,sans-serif;border-bottom:1px solid ${BORDER_COLOR};">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};margin-bottom:10px;font-family:Arial,sans-serif;">📡 Today's Threat Pulse</div>
          <p style="margin:0;font-size:16px;line-height:1.7;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;font-style:italic;">${escapeHtml(threatPulse)}</p>
        </td>
      </tr>${sectionSpacer}`
    : "";

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <meta name="x-apple-disable-message-reformatting" />
    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
    <style>
      :root { color-scheme: dark; supported-color-schemes: dark; }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${DARK_BG};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${DARK_BG};padding:16px 0;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background-color:${DARK_BG};border:2px solid ${BORDER_COLOR};border-radius:16px;">

            <tr>
              <td align="center" style="padding:16px 24px 14px 24px;font-family:Arial,sans-serif;font-size:13px;color:${TEXT_SECONDARY};">
                <a href="${siteBase}" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Read Online</a>
                &nbsp;·&nbsp;
                <a href="${siteBase}/subscribe" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Sign Up</a>
                &nbsp;·&nbsp;
                <a href="${siteBase}/contact" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Advertise</a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 16px 24px;line-height:0;">
                <img src="${coverImage}" alt="7secure" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border-radius:12px;" />
              </td>
            </tr>

            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;">
                <p style="margin:0;font-size:26px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};font-family:Arial,sans-serif;">Good morning, ${subscriberName}.</p>
                <p style="margin:10px 0 0 0;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${date}</p>
              </td>
            </tr>

            ${threatPulseBlock}

            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;">
                <p style="margin:0 0 12px 0;font-size:18px;line-height:1.3;font-weight:700;color:${TEXT_PRIMARY};font-family:Arial,sans-serif;">📋 In today's security briefing:</p>
                <ul style="margin:0;padding:0;list-style:none;font-family:Arial,sans-serif;">
                  ${dailyRundownList}
                </ul>
              </td>
            </tr>

            ${sectionSpacer}

            <tr>
              <td style="padding:16px 24px;font-family:Arial,sans-serif;">
                <span style="font-size:13px;font-weight:800;color:${ACCENT};letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">🔥 Latest Developments</span>
              </td>
            </tr>

            ${latestDevelopmentCards}

            ${sectionSpacer}

            ${ratingSection}

            ${sectionSpacer}

            ${authorSection ? `${authorSection}${sectionSpacer}` : ""}

            <tr>
              <td style="padding:24px;text-align:center;font-family:Arial,sans-serif;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:${TEXT_PRIMARY};">See you soon 👋</p>
                <p style="margin:10px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:${TEXT_SECONDARY};">
                  <a href="${unsubscribeUrl}" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildTextDigest = (
  articles: DigestArticle[],
  subscriber: DigestSubscriber,
  siteUrl: string
): string => {
  const siteBase = toSiteBase(siteUrl);
  const name = displayNameFromSubscriber(subscriber);
  const lines = [
    `7secure Daily Security Briefing (${new Date().toUTCString()})`,
    "",
    `Good morning, ${name}.`,
    "",
    "In today's security briefing:"
  ];

  for (const article of articles) {
    const link = safeUrl(article.original_url, `${siteBase}/articles/${article.slug}`);
    lines.push(`- ${stripEmojiInline(article.title)}`);
    lines.push(`  ${link}`);
  }

  lines.push("", "LATEST DEVELOPMENTS:");

  for (const article of articles) {
    const originalLink = safeUrl(article.original_url, `${siteBase}/articles/${article.slug}`);
    lines.push("", stripEmojiInline(article.title));
    lines.push(`Category: ${humanizeCategory(article.category)}`);
    lines.push(`Summary: ${clamp(stripEmojiInline(article.summary), 240)}`);
    lines.push(`Original source: ${originalLink}`);
    lines.push(`7secure version: ${siteBase}/articles/${article.slug}`);
  }

  const encodedEmail = encodeURIComponent(subscriber.email);
  lines.push("", "Rate today's digest:");
  lines.push(`- Nailed it: ${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=5`);
  lines.push(`- Average: ${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=3`);
  lines.push(`- Needs work: ${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=1`);
  lines.push("", `Unsubscribe: ${siteBase}/unsubscribe?email=${encodedEmail}`);

  return lines.join("\n");
};

export const sendDigest = async (
  env: WorkerEnv,
  newsletterTitle = "Daily Security Intelligence Brief",
  snippets: ArticleSnippet[] = [],
  threatPulse: string = ""
): Promise<DigestSendResult> => {
  const [allArticles, subscribers, authors] = await Promise.all([
    getRecentArticles(env),
    getSubscribers(env),
    getAuthors(env)
  ]);

  const candidateArticles = allArticles as DigestArticle[];
  const sentSlugs = await getSentArticleSlugs(
    env,
    candidateArticles.map((article) => article.slug)
  );
  const unsentArticles = candidateArticles.filter((article) => !sentSlugs.has(article.slug));
  const digestArticles = pickDigestArticles(unsentArticles);

  console.log(
    `Digest prep: ${digestArticles.length} unsent articles selected from ${candidateArticles.length} candidates for ${subscribers.length} confirmed subscribers`
  );

  if (!digestArticles.length || !subscribers.length) {
    if (!digestArticles.length) console.warn("Digest skipped: no unsent articles available to send.");
    if (!subscribers.length) console.warn("Digest skipped: no confirmed subscribers found.");
    return { articleCount: digestArticles.length, subscriberCount: subscribers.length, status: "success" };
  }

  if (!env.RESEND_API_KEY) {
    console.error("Digest failed: RESEND_API_KEY is missing.");
    return { articleCount: digestArticles.length, subscriberCount: subscribers.length, status: "failed" };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const fromEmail = env.RESEND_FROM_EMAIL || "7secure <onboarding@resend.dev>";
  if (/onboarding@resend\.dev/i.test(fromEmail)) {
    console.warn("RESEND_FROM_EMAIL is set to onboarding@resend.dev. Resend sandbox mode only delivers to your account email until a domain/sender is verified.");
  }

  const batches: Array<typeof subscribers> = [];
  for (let i = 0; i < subscribers.length; i += 100) {
    batches.push(subscribers.slice(i, i + 100));
  }

  let hadErrors = false;
  let deliveredCount = 0;

  try {
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const batchLabel = `${index + 1}/${batches.length}`;
      console.log(`Sending digest batch ${batchLabel} (${batch.length} recipients)`);

      const response = await resend.batch.send(
        batch.map((subscriber) => ({
          from: fromEmail,
          to: [subscriber.email],
          subject: newsletterTitle,
          html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL, newsletterTitle, snippets, authors, threatPulse),
          text: buildTextDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL)
        }))
      );

      if (response.error) {
        hadErrors = true;
        console.error(`Resend batch ${batchLabel} error: ${serializeError(response.error)}`);

        let fallbackDelivered = 0;
        for (const subscriber of batch) {
          const single = await resend.emails.send({
            from: fromEmail,
            to: [subscriber.email],
            subject: newsletterTitle,
            html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL, newsletterTitle, snippets, authors, threatPulse),
            text: buildTextDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL)
          });

          if (single.error) {
            console.error(`Resend single-send fallback failed for ${subscriber.email}: ${serializeError(single.error)}`);
          } else {
            fallbackDelivered += 1;
          }
        }

        deliveredCount += fallbackDelivered;
        console.log(`Resend fallback delivered ${fallbackDelivered}/${batch.length} recipients for batch ${batchLabel}`);
      } else {
        const accepted = response.data?.data?.length ?? 0;
        deliveredCount += accepted;
        console.log(`Resend batch ${batchLabel} accepted ${accepted}/${batch.length} messages`);
        if (accepted < batch.length) {
          hadErrors = true;
          console.error(`Resend batch ${batchLabel} accepted fewer messages than requested. Requested=${batch.length}, accepted=${accepted}`);
        }
      }
    }

    if (deliveredCount > 0) {
      await markDigestArticlesSent(env, digestArticles.map((article) => article.slug));
      console.log(`Marked ${digestArticles.length} digest articles as sent to prevent duplicate delivery.`);
    } else {
      console.warn("No digest messages were accepted; sent-article history was not updated.");
    }

    return { articleCount: digestArticles.length, subscriberCount: subscribers.length, status: hadErrors ? "failed" : "success" };
  } catch (error) {
    console.error(`Fatal error during digest sending: ${serializeError(error)}`);
    return { articleCount: digestArticles.length, subscriberCount: subscribers.length, status: "failed" };
  }
};
