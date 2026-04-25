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
}

interface DigestSubscriber {
  email: string;
  role?: string | null;
}

const ARTICLE_EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u200D]/gu;

const stripEmojiInline = (value: string): string => value.replace(ARTICLE_EMOJI_REGEX, "").replace(/\s+/g, " ").trim();

const stripMarkdown = (value: string): string =>
  stripEmojiInline(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^\)]*\)/g, " ")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_>~]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

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
  if (!candidate) {
    return fallback;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    return fallback;
  }
};

const resolveImageUrl = (
  imageUrl: string | null | undefined,
  siteBase: string,
  options?: { allowCover?: boolean }
): string | null => {
  const raw = (imageUrl || "").trim();
  if (!raw) {
    return null;
  }

  if (!options?.allowCover && /(^|\/)cover\.avif(?:$|\?)/i.test(raw)) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${siteBase}${raw}`;
  }

  return null;
};

const displayNameFromSubscriber = (subscriber: DigestSubscriber): string => {
  const role = (subscriber.role || "").trim();
  if (role) {
    return role.split(/\s+/)[0];
  }

  const localPart = subscriber.email.split("@")[0] || "there";
  const cleaned = localPart.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const first = cleaned.split(/\s+/)[0] || "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
};

const buildArticleScript = (
  article: DigestArticle
): { keyPoints: string; description: string; whyImportant: string; incidentOverview: string; securityImplications: string; recommendedMitigations: string } => {
  const content = article.content || "";

  const keyPointsMatch = content.match(/##\s*Key\s*(?:Points?|Takeaways?)\n([\s\S]*?)(?=\n##|$)/i);
  const descriptionMatch = content.match(/##\s*Description\n([\s\S]*?)(?=\n##|$)/i);
  const whyImportantMatch = content.match(/##\s*(?:Why\s+this\s+matters|Why\s+it'?s\s+important|Why\s+It\s+Matters?)\n([\s\S]*?)(?=\n##|$)/i);
  const incidentOverviewMatch = content.match(/##\s*Incident\s*Overview\n([\s\S]*?)(?=\n##|$)/i);
  const securityImplicationsMatch = content.match(/##\s*Security\s*Implications?\n([\s\S]*?)(?=\n##|$)/i);
  const recommendedMitigationsMatch = content.match(/##\s*Recommended\s*Mitigations?\n([\s\S]*?)(?=\n##|$)/i);

  if (!keyPointsMatch && !descriptionMatch && !whyImportantMatch && !incidentOverviewMatch) {
    return {
      keyPoints: "",
      description: clamp(stripMarkdown(content), 300),
      whyImportant: article.summary || "",
      incidentOverview: "",
      securityImplications: "",
      recommendedMitigations: ""
    };
  }

  return {
    keyPoints: keyPointsMatch ? keyPointsMatch[1].trim() : "",
    description: descriptionMatch ? descriptionMatch[1].trim() : "",
    whyImportant: whyImportantMatch ? whyImportantMatch[1].trim() : "",
    incidentOverview: incidentOverviewMatch ? incidentOverviewMatch[1].trim() : "",
    securityImplications: securityImplicationsMatch ? securityImplicationsMatch[1].trim() : "",
    recommendedMitigations: recommendedMitigationsMatch ? recommendedMitigationsMatch[1].trim() : ""
  };
};

const humanizeCategory = (category: string): string => category.replace(/-/g, " ");

const formatPublishDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return date.toUTCString().slice(5, 16);
};

const serializeError = (error: unknown): string => {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "object") {
    const maybe = error as { name?: unknown; message?: unknown };
    const name = typeof maybe.name === "string" ? maybe.name : "error";
    const message = typeof maybe.message === "string" ? maybe.message : "";

    if (message) {
      return `${name}: ${message}`;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return name;
    }
  }

  return String(error);
};

const pickDigestArticles = (articles: DigestArticle[]): DigestArticle[] => {
  const picks: DigestArticle[] = [];
  const byCategory = (category: string) =>
    articles.filter((article) => article.category === category).slice(0, 2);

  picks.push(...byCategory("threat-intel"));
  picks.push(...byCategory("industry-news"));
  picks.push(...byCategory("vulnerabilities"));

  const aiOrResearch = articles
    .filter((article) => ["ai-security", "research"].includes(article.category))
    .slice(0, 2);
  picks.push(...aiOrResearch);

  const unique = new Map<string, DigestArticle>();
  for (const article of picks) {
    unique.set(article.slug, article);
  }

  if (unique.size < 8) {
    for (const article of articles) {
      unique.set(article.slug, article);
      if (unique.size >= 8) {
        break;
      }
    }
  }

  return [...unique.values()].slice(0, 8);
};

// ─── Design Tokens ──────────────────────────────────────────────
const DARK_BG = "#0a0a0f";
const CARD_BG = "#111118";
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
      const script = buildArticleScript(article);

      const cleanScriptField = (text: string) => {
        const cleaned = text.replace(/[\[\]]/g, "").replace(/\.\.\./g, "").trim();
        return cleaned.length > 5 ? escapeHtml(stripEmojiInline(cleaned)) : "";
      };

      const markdownListToHtml = (mdList: string): string => {
        const items = mdList.split('\n').filter(line => line.trim().startsWith('-'));
        if (items.length === 0) return escapeHtml(mdList);
        return `<ul style="margin:10px 0 0 0;padding:0;list-style:none;">` +
          items.map(item => `<li style="margin-bottom:8px;padding-left:20px;position:relative;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};"><span style="position:absolute;left:0;color:${ACCENT};font-weight:700;">→</span>${escapeHtml(item.replace(/^- /, '').trim())}</li>`).join('') +
          `</ul>`;
      };

      const isIncident = Boolean(script.incidentOverview);

      const keyPointsHtml = script.keyPoints
        ? `<div style="margin:20px 0 0 0;"><strong style="font-size:15px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">🔑 Key Takeaways</strong>${markdownListToHtml(script.keyPoints)}</div>`
        : "";

      const descriptionHtml = !isIncident && script.description
        ? `<div style="margin:20px 0 0 0;"><strong style="font-size:15px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">📖 What Happened</strong><p style="margin:10px 0 0 0;font-size:17px;line-height:1.7;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${cleanScriptField(script.description)}</p></div>`
        : "";

      const whyImportantHtml = !isIncident && script.whyImportant
        ? `<div style="margin:20px 0 0 0;padding-top:18px;border-top:1px solid ${BORDER_COLOR};"><strong style="font-size:15px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">💡 Why It Matters</strong><p style="margin:10px 0 0 0;font-size:17px;line-height:1.7;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${cleanScriptField(script.whyImportant)}</p></div>`
        : "";

      const incidentOverviewHtml = isIncident && script.incidentOverview
        ? `<div style="margin:20px 0 0 0;"><strong style="font-size:15px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">⚠️ Incident Overview</strong><p style="margin:10px 0 0 0;font-size:17px;line-height:1.7;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${cleanScriptField(script.incidentOverview)}</p></div>`
        : "";

      const securityImplicationsHtml = isIncident && script.securityImplications
        ? `<div style="margin:20px 0 0 0;padding-top:18px;border-top:1px solid ${BORDER_COLOR};"><strong style="font-size:15px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">🎯 Security Implications</strong><p style="margin:10px 0 0 0;font-size:17px;line-height:1.7;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${cleanScriptField(script.securityImplications)}</p></div>`
        : "";

      const recommendedMitigationsHtml = isIncident && script.recommendedMitigations
        ? `<div style="margin:20px 0 0 0;padding-top:18px;border-top:1px solid ${BORDER_COLOR};"><strong style="font-size:15px;color:${TEXT_PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;">🛡️ Recommended Mitigations</strong>${markdownListToHtml(script.recommendedMitigations)}</div>`
        : "";

      const imageBlock = imageSrc
        ? `<img src="${imageSrc}" alt="${title}" width="100%" style="display:block;width:100%;height:auto;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:20px;" />`
        : "";

      const divider = index > 0 ? `<tr><td style="padding:0;"><div style="height:1px;background:${BORDER_COLOR};margin:0 24px;"></div></td></tr>${sectionSpacer}` : "";

      return `${divider}
      <tr>
        <td style="padding:24px;font-family:Arial,sans-serif;color:${TEXT_PRIMARY};">
          ${imageBlock}
          <div style="font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${ACCENT};margin-bottom:10px;font-family:Arial,sans-serif;">${category}</div>
          <a href="${originalHref}" style="font-size:24px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};text-decoration:none;display:block;font-family:Arial,sans-serif;">${title}</a>
          ${keyPointsHtml}
          ${descriptionHtml}
          ${whyImportantHtml}
          ${incidentOverviewHtml}
          ${securityImplicationsHtml}
          ${recommendedMitigationsHtml}
          <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;"><strong style="color:${TEXT_PRIMARY};">7secure</strong> · ${formatPublishDate(article.published_at)} · <a href="${newsletterHref}" style="color:${ACCENT};text-decoration:underline;font-weight:600;">Read full version →</a></p>
        </td>
      </tr>`;
    })
    .join("");

const buildQuickHitsSection = (): string => `
  <tr>
    <td style="padding:24px;font-family:Arial,sans-serif;">
      <div style="font-size:18px;font-weight:800;color:${TEXT_PRIMARY};margin-bottom:12px;font-family:Arial,sans-serif;">⚡ Quick Hits</div>
      <div style="font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};">Tool highlights and practice snapshots are being curated for the next briefing.</div>
    </td>
  </tr>`;

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
          <td style="padding:0 0 10px 0;"><a href="${feedbackLink(5)}" style="display:block;background:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:8px;padding:14px 16px;color:${TEXT_PRIMARY};text-decoration:none;font-size:18px;font-weight:700;font-family:Arial,sans-serif;">🛡️🛡️🛡️🛡️🛡️ Nailed it</a></td>
        </tr>
        <tr>
          <td style="padding:0 0 10px 0;"><a href="${feedbackLink(3)}" style="display:block;background:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:8px;padding:14px 16px;color:${TEXT_SECONDARY};text-decoration:none;font-size:18px;font-weight:700;font-family:Arial,sans-serif;">🛡️🛡️🛡️ Average</a></td>
        </tr>
        <tr>
          <td style="padding:0;"><a href="${feedbackLink(1)}" style="display:block;background:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:8px;padding:14px 16px;color:${TEXT_SECONDARY};text-decoration:none;font-size:18px;font-weight:700;font-family:Arial,sans-serif;">🛡️ Needs work</a></td>
        </tr>
      </table>
    </td>
  </tr>`;
};

const buildAuthorSection = (siteBase: string, authors: Array<{ name: string; image_url?: string | null }>): string => {
  const authorItems = authors.map((author) => {
    const img = author.image_url
      ? `<img src="${author.image_url}" alt="${escapeHtml(author.name)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};" />`
      : `<div style="width:40px;height:40px;border-radius:50%;background:${ACCENT};display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:16px;font-weight:700;">${author.name.charAt(0).toUpperCase()}</div>`;
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
  authors: Array<{ name: string; image_url?: string | null }> = []
): string => {
  const siteBase = toSiteBase(siteUrl);
  const date = new Date().toUTCString().slice(5, 16);
  const subscriberName = escapeHtml(displayNameFromSubscriber(subscriber));
  const unsubscribeUrl = `${siteBase}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
  const coverImage = `${siteBase}/cover.avif`;
  const dailyRundownList = buildDailyRundownList(articles);
  const latestDevelopmentCards = buildLatestDevelopmentCards(articles, siteBase);
  const ratingSection = buildRatingSection(subscriber.email, siteBase);
  const quickHits = buildQuickHitsSection();
  const authorSection = authors.length > 0 ? buildAuthorSection(siteBase, authors) : "";

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
    <!-- outer wrapper -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${DARK_BG};padding:16px 0;">
      <tr>
        <td align="center" style="padding:0;">

          <!-- single bordered container -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background-color:${DARK_BG};border:2px solid ${BORDER_COLOR};border-radius:16px;">

            <!-- nav bar -->
            <tr>
              <td align="center" style="padding:16px 24px 14px 24px;font-family:Arial,sans-serif;font-size:13px;color:${TEXT_SECONDARY};">
                <a href="${siteBase}" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Read Online</a>
                &nbsp;·&nbsp;
                <a href="${siteBase}/subscribe" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Sign Up</a>
                &nbsp;·&nbsp;
                <a href="${siteBase}/contact" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Advertise</a>
              </td>
            </tr>

            <!-- cover image -->
            <tr>
              <td style="padding:0 24px 16px 24px;line-height:0;">
                <img src="${coverImage}" alt="7secure" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border-radius:12px;" />
              </td>
            </tr>

            <!-- greeting -->
            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;">
                <p style="margin:0;font-size:26px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};font-family:Arial,sans-serif;">Good morning, ${subscriberName}.</p>
                <p style="margin:10px 0 0 0;font-size:16px;line-height:1.6;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${date} briefing: clear threat context, key developments, and quick actions worth prioritizing today.</p>
              </td>
            </tr>

            ${sectionSpacer}

            <!-- briefing rundown -->
            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;">
                <p style="margin:0 0 12px 0;font-size:18px;line-height:1.3;font-weight:700;color:${TEXT_PRIMARY};font-family:Arial,sans-serif;">📋 In today's security briefing:</p>
                <ul style="margin:0;padding:0;list-style:none;font-family:Arial,sans-serif;">
                  ${dailyRundownList}
                </ul>
              </td>
            </tr>

            ${sectionSpacer}

            <!-- latest developments header -->
            <tr>
              <td style="padding:16px 24px;font-family:Arial,sans-serif;">
                <span style="font-size:13px;font-weight:800;color:${ACCENT};letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">🔥 Latest Developments</span>
              </td>
            </tr>

            <!-- article cards (no inner borders) -->
            ${latestDevelopmentCards}

            ${sectionSpacer}

            <!-- quick hits -->
            ${quickHits}

            ${sectionSpacer}

            <!-- rating -->
            ${ratingSection}

            ${sectionSpacer}

            <!-- author section -->
            ${authorSection ? `${authorSection}${sectionSpacer}` : ""}

            <!-- footer -->
            <tr>
              <td style="padding:24px;text-align:center;font-family:Arial,sans-serif;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:${TEXT_PRIMARY};">See you soon 👋</p>
                <p style="margin:10px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:${TEXT_SECONDARY};">
                  <a href="${unsubscribeUrl}" style="color:${TEXT_SECONDARY};text-decoration:underline;font-weight:600;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
          <!-- /single bordered container -->

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

  lines.push(
    ""
  );

  lines.push("LATEST DEVELOPMENTS:");

  for (const article of articles) {
    const originalLink = safeUrl(article.original_url, `${siteBase}/articles/${article.slug}`);
    const script = buildArticleScript(article);
    lines.push("");
    lines.push(`${stripEmojiInline(article.title)}`);
    lines.push(`Category: ${humanizeCategory(article.category)}`);
    lines.push(`Why this matters: ${clamp(stripEmojiInline(article.summary), 240)}`);
    if (script.keyPoints) {
      lines.push(`Key Points:`);
      const items = script.keyPoints.split('\n').filter(line => line.trim().startsWith('-'));
      if (items.length > 0) {
        items.forEach(item => lines.push(`  ${item.trim()}`));
      } else {
        lines.push(`  ${script.keyPoints}`);
      }
    }

    const cleanText = (text: string) => stripEmojiInline(text.replace(/[\[\]]/g, "").replace(/\.\.\./g, "").trim());

    if (script.description) {
      const desc = cleanText(script.description);
      if (desc.length > 5) lines.push(`Description: ${desc}`);
    }
    if (script.whyImportant) {
      const why = cleanText(script.whyImportant);
      if (why.length > 5) lines.push(`Why this matters: ${why}`);
    }
    lines.push(`Original source: ${originalLink}`);
    lines.push(`7secure version: ${siteBase}/articles/${article.slug}`);
  }

  lines.push("");
  lines.push("QUICK HITS:");
  lines.push("- Trending tools section is being curated.");
  lines.push("- Security practices section is being prepared.");

  const encodedEmail = encodeURIComponent(subscriber.email);
  lines.push("");
  lines.push("Rate today's digest:");
  lines.push(`- Nailed it: ${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=5`);
  lines.push(`- Average: ${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=3`);
  lines.push(`- Needs work: ${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=1`);

  lines.push(
    "",
    `Unsubscribe: ${siteBase}/unsubscribe?email=${encodedEmail}`
  );

  return lines.join("\n");
};

export const sendDigest = async (
  env: WorkerEnv,
  newsletterTitle = "Daily Security Intelligence Brief",
  snippets: ArticleSnippet[] = []
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
    if (!digestArticles.length) {
      console.warn("Digest skipped: no unsent articles available to send.");
    }
    if (!subscribers.length) {
      console.warn("Digest skipped: no confirmed subscribers found.");
    }
    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: "success"
    };
  }

  if (!env.RESEND_API_KEY) {
    console.error("Digest failed: RESEND_API_KEY is missing.");
    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: "failed"
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const fromEmail = env.RESEND_FROM_EMAIL || "7secure <onboarding@resend.dev>";
  if (/onboarding@resend\.dev/i.test(fromEmail)) {
    console.warn(
      "RESEND_FROM_EMAIL is set to onboarding@resend.dev. Resend sandbox mode only delivers to your account email until a domain/sender is verified."
    );
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
          html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL, newsletterTitle, snippets, authors),
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
            html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL, newsletterTitle, snippets, authors),
            text: buildTextDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL)
          });

          if (single.error) {
            console.error(
              `Resend single-send fallback failed for ${subscriber.email}: ${serializeError(single.error)}`
            );
          } else {
            fallbackDelivered += 1;
          }
        }

        deliveredCount += fallbackDelivered;

        console.log(
          `Resend fallback delivered ${fallbackDelivered}/${batch.length} recipients for batch ${batchLabel}`
        );
      } else {
        const accepted = response.data?.data?.length ?? 0;
        deliveredCount += accepted;
        console.log(`Resend batch ${batchLabel} accepted ${accepted}/${batch.length} messages`);
        if (accepted < batch.length) {
          hadErrors = true;
          console.error(
            `Resend batch ${batchLabel} accepted fewer messages than requested. Requested=${batch.length}, accepted=${accepted}`
          );
        }
      }
    }

    if (deliveredCount > 0) {
      await markDigestArticlesSent(
        env,
        digestArticles.map((article) => article.slug)
      );
      console.log(
        `Marked ${digestArticles.length} digest articles as sent to prevent duplicate delivery.`
      );
    } else {
      console.warn("No digest messages were accepted; sent-article history was not updated.");
    }

    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: hadErrors ? "failed" : "success"
    };
  } catch (error) {
    console.error(`Fatal error during digest sending: ${serializeError(error)}`);
    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: "failed"
    };
  }
};
