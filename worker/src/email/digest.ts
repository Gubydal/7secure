import { Resend } from "resend";
import {
  getRecentArticles,
  getSentArticleSlugs,
  getSubscribers,
  markDigestArticlesSent
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
    .replace(/\"/g, "&quot;")
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

const EMAIL_THEME = {
  pageBg: "#05070d",
  shellBg: "#070b15",
  panelBg: "#090f1b",
  frameBorder: "#394465",
  headingText: "#f0f4ff",
  bodyText: "#d4daee",
  mutedText: "#98a2bd",
  linkText: "#9ec8ff"
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

const buildDailyRundownList = (articles: DigestArticle[]): string =>
  articles
    .map((article) => {
      return `<li style="margin:0 0 8px 0;color:#334155;">${escapeHtml(stripEmojiInline(article.title))}</li>`;
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
        return `<ul style="margin:8px 0 0 20px;padding:0;color:#334155;font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">` +
          items.map(item => `<li style="margin-bottom:4px;">${escapeHtml(item.replace(/^- /, '').trim())}</li>`).join('') +
          `</ul>`;
      };

      const isIncident = Boolean(script.incidentOverview);

      const keyPointsHtml = script.keyPoints
        ? `<div style="margin:16px 0 0 0;"><strong style="font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;">Key Takeaways</strong>${markdownListToHtml(script.keyPoints)}</div>`
        : "";

      const descriptionHtml = !isIncident && script.description
        ? `<div style="margin:16px 0 0 0;"><strong style="font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;">Description</strong><p style="margin:6px 0 0 0;font-size:15px;line-height:1.6;color:#334155;font-family:Arial,sans-serif;">${cleanScriptField(script.description)}</p></div>`
        : "";

      const whyImportantHtml = !isIncident && script.whyImportant
        ? `<div style="margin:16px 0 0 0;border-top:1px solid #e8ecf5;padding-top:14px;"><strong style="font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;">Why It Matters</strong><p style="margin:6px 0 0 0;font-size:15px;line-height:1.6;color:#334155;font-family:Arial,sans-serif;">${cleanScriptField(script.whyImportant)}</p></div>`
        : "";

      const incidentOverviewHtml = isIncident && script.incidentOverview
        ? `<div style="margin:16px 0 0 0;"><strong style="font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;">Incident Overview</strong><p style="margin:6px 0 0 0;font-size:15px;line-height:1.6;color:#334155;font-family:Arial,sans-serif;">${cleanScriptField(script.incidentOverview)}</p></div>`
        : "";

      const securityImplicationsHtml = isIncident && script.securityImplications
        ? `<div style="margin:16px 0 0 0;border-top:1px solid #e8ecf5;padding-top:14px;"><strong style="font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;">Security Implications</strong><p style="margin:6px 0 0 0;font-size:15px;line-height:1.6;color:#334155;font-family:Arial,sans-serif;">${cleanScriptField(script.securityImplications)}</p></div>`
        : "";

      const recommendedMitigationsHtml = isIncident && script.recommendedMitigations
        ? `<div style="margin:16px 0 0 0;border-top:1px solid #e8ecf5;padding-top:14px;"><strong style="font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;">Recommended Mitigations</strong>${markdownListToHtml(script.recommendedMitigations)}</div>`
        : "";

      const isCoverFallback = !imageSrc || /cover\.avif(?:$|\?)/i.test(imageSrc || "");
      const imageBlock = imageSrc && !isCoverFallback
        ? `<img src="${imageSrc}" alt="${title}" width="100%" style="display:block;width:100%;height:auto;max-height:200px;object-fit:cover;" />`
        : "";
      return `
      <tr>
        <td style="padding:${index === 0 ? "0" : "20px 0 0 0"}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:0;font-family:Arial,sans-serif;color:#0f172a;">
                ${imageBlock}
                <div style="padding:24px;">
                  <div style="font-size:11px;letter-spacing:0.13em;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-family:Arial,sans-serif;">${category}</div>
                  <a href="${originalHref}" style="font-size:24px;line-height:1.25;font-weight:700;color:#1d4ed8;text-decoration:underline;display:block;font-family:Arial,sans-serif;">${title}</a>
                  ${keyPointsHtml}
                  ${descriptionHtml}
                  ${whyImportantHtml}
                  ${incidentOverviewHtml}
                  ${securityImplicationsHtml}
                  ${recommendedMitigationsHtml}
                  <p style="margin:16px 0 0 0;font-size:13px;line-height:1.4;color:#94a3b8;font-family:Arial,sans-serif;">7secure &middot; ${formatPublishDate(article.published_at)} &middot; <a href="${newsletterHref}" style="color:#1d4ed8;text-decoration:underline;">Read full version</a></p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

const buildQuickHitsSection = (): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:16px 18px 14px 18px;font-family:Inter,Arial,sans-serif;">
        <a href="#" style="font-size:16px;line-height:1.35;font-weight:700;color:#1d4ed8;text-decoration:underline;display:block;">Trending Tools</a>
        <ul style="margin:10px 0 0 18px;padding:0;color:#475569;font-size:13px;line-height:1.6;">
          <li>Tool highlights will appear here in the next digest.</li>
        </ul>
      </td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-top:12px;">
    <tr>
      <td style="padding:14px 14px 12px 14px;font-family:Inter,Arial,sans-serif;">
        <a href="#" style="font-size:16px;line-height:1.35;font-weight:700;color:#1d4ed8;text-decoration:underline;display:block;">Security Practices</a>
        <ul style="margin:10px 0 0 18px;padding:0;color:#475569;font-size:13px;line-height:1.6;">
          <li>Practice snapshots are being prepared for this section.</li>
        </ul>
      </td>
    </tr>
  </table>`;

const buildRatingSection = (subscriberEmail: string, siteBase: string): string => {
  const encodedEmail = encodeURIComponent(subscriberEmail);
  const feedbackLink = (rating: number): string =>
    `${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=${rating}&context=daily_digest_email`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 16px 18px 16px;font-family:Inter,Arial,sans-serif;">
        <div style="font-size:32px;line-height:1.2;font-weight:700;color:#0f172a;">That's it for today!</div>
        <p style="margin:6px 0 14px 0;font-size:15px;line-height:1.6;color:#475569;">Before you go, rate today's newsletter so we can keep improving your daily security briefing.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 8px 0;"><a href="${feedbackLink(5)}" style="display:block;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;color:#334155;text-decoration:none;font-size:26px;background-color:#ffffff;">★★★★★ <span style="font-size:16px;">Nailed it</span></a></td>
          </tr>
          <tr>
            <td style="padding:0 0 8px 0;"><a href="${feedbackLink(3)}" style="display:block;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;color:#334155;text-decoration:none;font-size:20px;background-color:#ffffff;">★★★ <span style="font-size:16px;">Average</span></a></td>
          </tr>
          <tr>
            <td style="padding:0;"><a href="${feedbackLink(1)}" style="display:block;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;color:#334155;text-decoration:none;font-size:16px;background-color:#ffffff;">★ <span style="font-size:16px;">Needs work</span></a></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

const buildSnippetSection = (snippets: ArticleSnippet[], siteBase: string): string => {
  if (!snippets.length) return "";
  const items = snippets
    .map((s) => {
      const href = `${siteBase}/articles/${s.slug}`;
      return `<tr><td style="padding:6px 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#334155;"><a href="${href}" style="color:#1d4ed8;text-decoration:underline;font-weight:600;">${escapeHtml(stripEmojiInline(s.title))}</a> — ${escapeHtml(stripEmojiInline(s.hook))}</td></tr>`;
    })
    .join("");
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#f0f4ff;border:1px solid #c7d2fe;border-radius:12px;overflow:hidden;margin-bottom:20px;">
    <tr>
      <td style="padding:16px 20px 12px 20px;font-family:Arial,sans-serif;">
        <div style="font-size:13px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">📋 Snippet of the Week</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${items}
        </table>
      </td>
    </tr>
  </table>`;
};

const buildHtmlDigest = (
  articles: DigestArticle[],
  subscriber: DigestSubscriber,
  siteUrl: string,
  newsletterTitle: string,
  snippets: ArticleSnippet[]
): string => {
  const siteBase = toSiteBase(siteUrl);
  const date = new Date().toUTCString().slice(5, 16);
  const subscriberName = escapeHtml(displayNameFromSubscriber(subscriber));
  const unsubscribeUrl = `${siteBase}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
  const coverImage = `${siteBase}/cover.avif`;
  const dailyRundownList = buildDailyRundownList(articles);
  const snippetSection = buildSnippetSection(snippets, siteBase);
  const latestDevelopmentCards = buildLatestDevelopmentCards(articles, siteBase);
  const ratingSection = buildRatingSection(subscriber.email, siteBase);
  const quickHits = buildQuickHitsSection();
  const socialIconLinks = [
    {
      href: siteBase,
      label: "Website",
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#dbe3ff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2zm7.92 9h-3.05a15.9 15.9 0 0 0-1.02-4.58A8.03 8.03 0 0 1 19.92 11zM12 4.04c.73.96 1.65 3.12 1.87 6.96h-3.74C10.35 7.16 11.27 5 12 4.04zM8.15 6.42A15.9 15.9 0 0 0 7.13 11H4.08a8.03 8.03 0 0 1 4.07-4.58zM4.08 13h3.05a15.9 15.9 0 0 0 1.02 4.58A8.03 8.03 0 0 1 4.08 13zM12 19.96c-.73-.96-1.65-3.12-1.87-6.96h3.74c-.22 3.84-1.14 6-1.87 6.96zm3.85-2.38A15.9 15.9 0 0 0 16.87 13h3.05a8.03 8.03 0 0 1-4.07 4.58z"/></svg>'
    },
    {
      href: "https://x.com",
      label: "X",
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#dbe3ff" xmlns="http://www.w3.org/2000/svg"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933zm-1.291 19.493h2.039L6.486 3.248H4.298z"/></svg>'
    },
    {
      href: "https://linkedin.com",
      label: "LinkedIn",
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#dbe3ff" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
    },
    {
      href: "https://instagram.com",
      label: "Instagram",
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#dbe3ff" xmlns="http://www.w3.org/2000/svg"><path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5c3.176 0 5.75-2.574 5.75-5.75v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 2h8.5A3.75 3.75 0 0 1 20 7.75v8.5A3.75 3.75 0 0 1 16.25 20h-8.5A3.75 3.75 0 0 1 4 16.25v-8.5A3.75 3.75 0 0 1 7.75 4zm8.9 1.45a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>'
    },
    {
      href: "https://reddit.com",
      label: "Reddit",
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#dbe3ff" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"/></svg>'
    }
  ]
    .map(
      (item) =>
        `<a href="${item.href}" style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;border:1px solid ${EMAIL_THEME.frameBorder};background:${EMAIL_THEME.panelBg};margin-right:8px;text-decoration:none;line-height:0;">${item.svg}</a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <meta name="x-apple-disable-message-reformatting" />
    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
    <style>
      :root { color-scheme: light; supported-color-schemes: light; }
      @media (prefers-color-scheme: dark) {
        .body-bg { background-color: #111827 !important; }
        .card-bg { background-color: #ffffff !important; }
        .card-text { color: #0f172a !important; }
        .card-muted { color: #64748b !important; }
        .card-divider { border-color: #f1f5f9 !important; }
      }
    </style>
  </head>
  <body class="body-bg" style="margin:0;padding:0;background-color:#111827;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" data-ogsc>
    <!-- outer wrapper -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#111827;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0;">

          <!-- nav bar above card -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding:0 0 10px 0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;">
                <a href="${siteBase}" style="color:#9ca3af;text-decoration:underline;">Read Online</a>
                &nbsp;|&nbsp;
                <a href="${siteBase}/subscribe" style="color:#9ca3af;text-decoration:underline;">Sign Up</a>
                &nbsp;|&nbsp;
                <a href="${siteBase}/contact" style="color:#9ca3af;text-decoration:underline;">Advertise</a>
              </td>
            </tr>
          </table>

          <!-- email card: white bg, 1px fine border -->
          <table class="card-bg" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:1px solid #EBEBEB;overflow:hidden;" data-ogsc>

            <!-- cover image -->
            <tr>
              <td style="padding:0;line-height:0;">
                <img src="${coverImage}" alt="7secure" width="100%" style="display:block;width:100%;height:auto;max-height:200px;object-fit:cover;" />
              </td>
            </tr>

            <!-- greeting section -->
            <tr>
              <td class="card-bg card-text" style="background-color:#ffffff;padding:24px 24px 20px 24px;border-bottom:1px solid #f1f5f9;" data-ogsc>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-family:Arial,sans-serif;">
                      <p class="card-text" style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;">Good morning, ${subscriberName}.</p>
                      <p class="card-muted" style="margin:10px 0 0 0;font-size:14px;line-height:1.7;color:#64748b;">${date} briefing: clear threat context, key developments, and quick actions worth prioritizing today.</p>
                      <p class="card-text" style="margin:16px 0 6px 0;font-size:15px;line-height:1.4;font-weight:700;color:#0f172a;">In today's security briefing:</p>
                      <ul style="margin:0 0 0 20px;padding:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#475569;">
                        ${dailyRundownList}
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- snippet of the week -->
            ${snippetSection ? `<tr><td class="card-bg" style="background-color:#ffffff;padding:24px;border-bottom:1px solid #f1f5f9;" data-ogsc>${snippetSection}</td></tr>` : ""}

            <!-- latest developments section -->
            <tr>
              <td class="card-bg" style="background-color:#ffffff;padding:24px;border-bottom:1px solid #f1f5f9;" data-ogsc>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-family:Arial,sans-serif;padding-bottom:16px;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Latest Developments</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        ${latestDevelopmentCards}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- quick hits section -->
            <tr>
              <td class="card-bg" style="background-color:#ffffff;padding:24px;border-bottom:1px solid #f1f5f9;" data-ogsc>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-family:Arial,sans-serif;padding-bottom:16px;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Quick Hits</span>
                    </td>
                  </tr>
                  <tr>
                    <td>${quickHits}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- rating section -->
            <tr>
              <td class="card-bg" style="background-color:#ffffff;padding:24px;border-bottom:1px solid #f1f5f9;" data-ogsc>
                ${ratingSection}
              </td>
            </tr>

            <!-- footer -->
            <tr>
              <td class="card-bg" style="background-color:#ffffff;padding:20px 24px;text-align:center;" data-ogsc>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:#0f172a;">See you soon 👋</p>
                <p style="margin:8px 0 0 0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;">
                  <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
          <!-- /email card -->

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
  const [allArticles, subscribers] = await Promise.all([
    getRecentArticles(env),
    getSubscribers(env)
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
          html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL, newsletterTitle, snippets),
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
            html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL, newsletterTitle, snippets),
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
