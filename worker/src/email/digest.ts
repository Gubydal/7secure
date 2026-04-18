import { Resend } from "resend";
import {
  getRecentArticles,
  getSentArticleSlugs,
  getSubscribers,
  markDigestArticlesSent
} from "../db/supabase";
import type { WorkerEnv } from "../types";

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

const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

const buildInsightPreview = (article: DigestArticle): string => {
  const base = stripMarkdown(article.content || "");
  if (!base) {
    return "The source highlights operational implications that require validation against your current controls and response playbooks.";
  }

  const sentences = (base.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const preview = sentences.slice(0, 3).join(" ") || base;
  return clamp(preview, 320);
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

const buildDailyRundownList = (articles: DigestArticle[]): string =>
  articles
    .map((article) => {
      return `<li style="margin:0 0 8px 0;">${escapeHtml(article.title)}</li>`;
    })
    .join("");

const buildLatestDevelopmentCards = (articles: DigestArticle[], siteBase: string): string =>
  articles
    .map((article, index) => {
      const newsletterHref = `${siteBase}/articles/${article.slug}`;
      const originalHref = safeUrl(article.original_url, newsletterHref);
      const imageSrc = resolveImageUrl(article.image_url, siteBase);
      const category = escapeHtml(humanizeCategory(article.category).toUpperCase());
      const title = escapeHtml(article.title);
      const whyItMatters = escapeHtml(clamp(article.summary, 220));
      const preview = escapeHtml(buildInsightPreview(article));
      const imageBlock = imageSrc
        ? `<tr><td style="padding:12px 14px 0 14px;"><img src="${imageSrc}" alt="${title}" width="100%" style="display:block;width:100%;height:auto;max-height:210px;object-fit:cover;border-radius:10px;" /></td></tr>`
        : "";

      return `
      <tr>
        <td style="padding:${index === 0 ? "0" : "14px 0 0 0"};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #394465;border-radius:12px;overflow:hidden;">
            ${imageBlock}
            <tr>
              <td style="padding:14px 14px 14px 14px;font-family:Inter,Arial,sans-serif;color:#e8ecf8;">
                <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#97a1c4;margin-bottom:8px;">${category}</div>
                <a href="${originalHref}" style="font-size:24px;line-height:1.3;font-weight:700;color:#8ea2ff;text-decoration:underline;display:block;">${title}</a>
                <p style="margin:10px 0 0 0;font-size:14px;line-height:1.56;color:#d4daee;"><strong style="color:#eef2ff;">Why this matters:</strong> ${whyItMatters}</p>
                <p style="margin:12px 0 0 0;font-size:14px;line-height:1.58;color:#c8d0ea;">${preview}</p>
                <p style="margin:12px 0 0 0;font-size:12px;line-height:1.4;color:#98a2bd;">${formatPublishDate(article.published_at)} · <a href="${newsletterHref}" style="color:#9ec8ff;text-decoration:underline;">Read 7secure version</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

const buildQuickHitsSection = (): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #394465;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:14px 14px 12px 14px;font-family:Inter,Arial,sans-serif;">
        <a href="#" style="font-size:16px;line-height:1.35;font-weight:700;color:#8ea2ff;text-decoration:underline;display:block;">🛠️ Trending Tools</a>
        <ul style="margin:10px 0 0 18px;padding:0;color:#d2d8ec;font-size:13px;line-height:1.6;">
          <li>Tool highlights will appear here in the next digest.</li>
        </ul>
      </td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #394465;border-radius:12px;overflow:hidden;margin-top:12px;">
    <tr>
      <td style="padding:14px 14px 12px 14px;font-family:Inter,Arial,sans-serif;">
        <a href="#" style="font-size:16px;line-height:1.35;font-weight:700;color:#8ea2ff;text-decoration:underline;display:block;">🛡️ Security Practices</a>
        <ul style="margin:10px 0 0 18px;padding:0;color:#d2d8ec;font-size:13px;line-height:1.6;">
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #394465;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 16px 18px 16px;font-family:Inter,Arial,sans-serif;">
        <div style="font-size:40px;line-height:1.2;font-weight:700;color:#f1f4ff;">That's it for today!</div>
        <p style="margin:6px 0 14px 0;font-size:15px;line-height:1.6;color:#cdd5ec;">Before you go, rate today's newsletter so we can keep improving your daily security briefing.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 8px 0;"><a href="${feedbackLink(5)}" style="display:block;border:1px solid #23283a;border-radius:8px;padding:10px 12px;color:#dbe3ff;text-decoration:none;font-size:26px;">★★★★★ <span style="font-size:16px;">Nailed it</span></a></td>
          </tr>
          <tr>
            <td style="padding:0 0 8px 0;"><a href="${feedbackLink(3)}" style="display:block;border:1px solid #23283a;border-radius:8px;padding:10px 12px;color:#dbe3ff;text-decoration:none;font-size:20px;">★★★ <span style="font-size:16px;">Average</span></a></td>
          </tr>
          <tr>
            <td style="padding:0;"><a href="${feedbackLink(1)}" style="display:block;border:1px solid #23283a;border-radius:8px;padding:10px 12px;color:#dbe3ff;text-decoration:none;font-size:16px;">★ <span style="font-size:16px;">Needs work</span></a></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

const buildHtmlDigest = (
  articles: DigestArticle[],
  subscriber: DigestSubscriber,
  siteUrl: string
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
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#dbe3ff" xmlns="http://www.w3.org/2000/svg"><path d="M24 11.695c0-1.34-1.104-2.43-2.463-2.43-.665 0-1.268.261-1.713.683-1.697-1.16-3.973-1.91-6.5-2.008l1.097-3.452 2.991.699c.003 1.27 1.049 2.298 2.335 2.298 1.288 0 2.335-1.032 2.335-2.304s-1.047-2.304-2.335-2.304c-.92 0-1.714.526-2.094 1.292l-3.376-.79c-.18-.04-.365.06-.421.234l-1.224 3.846c-2.795.074-5.305.828-7.149 2.004-.444-.407-1.036-.659-1.688-.659C1.104 9.265 0 10.355 0 11.695c0 .89.489 1.664 1.209 2.09-.047.214-.074.435-.074.659 0 3.383 4.016 6.126 8.97 6.126s8.97-2.743 8.97-6.126c0-.215-.024-.426-.068-.631.749-.422 1.26-1.208 1.26-2.118zm-17.55 1.534c0-.965.8-1.748 1.786-1.748.987 0 1.787.783 1.787 1.748 0 .965-.8 1.748-1.787 1.748-.986 0-1.786-.783-1.786-1.748zm9.938 4.037c-.784.784-2.302 1.133-3.791 1.133-1.488 0-3.006-.35-3.79-1.133-.3-.3-.3-.786 0-1.085.3-.3.787-.3 1.086 0 .402.402 1.313.686 2.704.686 1.39 0 2.302-.284 2.703-.686.3-.3.786-.3 1.086 0 .3.299.3.786 0 1.085zm-.25-2.245c-.987 0-1.787-.783-1.787-1.748 0-.965.8-1.748 1.787-1.748.986 0 1.786.783 1.786 1.748 0 .965-.8 1.748-1.786 1.748z"/></svg>'
    }
  ]
    .map(
      (item) =>
        `<a href="${item.href}" style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;border:1px solid #394465;background:#101420;margin-right:8px;text-decoration:none;line-height:0;">${item.svg}</a>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <style>
      @media (prefers-color-scheme: light) {
        .digest-bg { background:#f3f5fa !important; }
        .digest-shell { background:#ffffff !important; border-color:#dce2f1 !important; }
        .digest-copy { color:#172034 !important; }
      }
    </style>
  </head>
  <body class="digest-bg" style="margin:0;padding:0;background:#0a0c12;color:#e8e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c12;padding:16px 6px;">
      <tr>
        <td align="center">
          <table class="digest-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;background:#0f121b;border:1px solid #2c3144;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:14px 16px 6px 16px;font-family:Inter,Arial,sans-serif;">
                <div style="text-align:right;font-size:14px;line-height:1.5;">
                  <a href="${siteBase}" style="color:#9aa6cc;text-decoration:underline;">Read Online</a>
                  <span style="color:#576082;"> | </span>
                  <a href="${siteBase}/subscribe" style="color:#9aa6cc;text-decoration:underline;">Sign Up</a>
                  <span style="color:#576082;"> | </span>
                  <a href="${siteBase}/contact" style="color:#9aa6cc;text-decoration:underline;">Advertise</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 16px 0 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #394465;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:10px;">
                      <img src="${coverImage}" alt="7secure cover" width="100%" style="display:block;width:100%;height:auto;max-height:230px;object-fit:cover;border-radius:10px;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;font-family:Inter,Arial,sans-serif;">
                <table class="digest-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #394465;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td class="digest-copy" style="padding:16px;color:#e8ecf8;">
                      <p style="margin:0;font-size:30px;line-height:1.3;font-weight:700;">Good morning, ${subscriberName}.</p>
                      <p style="margin:12px 0 0 0;font-size:16px;line-height:1.68;color:#cdd5ec;">${date} briefing: clear threat context, key developments, and quick actions worth prioritizing today.</p>
                      <p style="margin:16px 0 0 0;font-size:22px;line-height:1.34;font-weight:700;">In today's security rundown:</p>
                      <ul style="margin:10px 0 0 18px;padding:0;color:#d6ddf4;font-size:14px;line-height:1.55;">
                        ${dailyRundownList}
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;font-family:Inter,Arial,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#000000;border:1px solid #394465;border-radius:10px;overflow:hidden;">
                  <tr><td style="padding:10px 14px;text-align:center;font-size:30px;line-height:1.2;font-weight:700;color:#f0f4ff;letter-spacing:0.03em;">LATEST DEVELOPMENTS</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${latestDevelopmentCards}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;font-family:Inter,Arial,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#000000;border:1px solid #394465;border-radius:10px;overflow:hidden;">
                  <tr><td style="padding:10px 14px;text-align:center;font-size:30px;line-height:1.2;font-weight:700;color:#f0f4ff;letter-spacing:0.03em;">QUICK HITS</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;">
                ${quickHits}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;">
                ${ratingSection}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 20px 16px;font-family:Inter,Arial,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#0f1118;border:1px solid #394465;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:16px;">
                      <p style="margin:0;font-size:15px;line-height:1.7;color:#d4dbf2;">See you soon,</p>
                      <p style="margin:8px 0 0 0;font-size:15px;line-height:1.7;color:#d4dbf2;"><em>The humans behind 7secure</em></p>
                      <div style="margin:14px 0 0 0;">${socialIconLinks}</div>
                      <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#9ba8c8;">
                        <a href="${unsubscribeUrl}" style="color:#9ec8ff;text-decoration:underline;">Unsubscribe</a>
                      </p>
                    </td>
                  </tr>
                </table>
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
    "In today's security rundown:"
  ];

  for (const article of articles) {
    const link = safeUrl(article.original_url, `${siteBase}/articles/${article.slug}`);
    lines.push(`- ${article.title}`);
    lines.push(`  ${link}`);
  }

  lines.push(
    ""
  );

  lines.push("LATEST DEVELOPMENTS:");

  for (const article of articles) {
    const originalLink = safeUrl(article.original_url, `${siteBase}/articles/${article.slug}`);
    lines.push("");
    lines.push(`${article.title}`);
    lines.push(`Category: ${humanizeCategory(article.category)}`);
    lines.push(`Why this matters: ${clamp(article.summary, 240)}`);
    lines.push(`Brief analysis: ${clamp(buildInsightPreview(article), 320)}`);
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

export const sendDigest = async (env: WorkerEnv): Promise<DigestSendResult> => {
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
          subject: "7secure Daily Security Briefing",
          html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL),
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
            subject: "7secure Daily Security Briefing",
            html: buildHtmlDigest(digestArticles, subscriber as DigestSubscriber, env.NEXT_PUBLIC_SITE_URL),
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
