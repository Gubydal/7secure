import { Resend } from "resend";
import { getRecentArticles, getSubscribers } from "../db/supabase";
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
  category: string;
  published_at: string;
}

const categoryColor = (category: string): string => {
  switch (category) {
    case "threat-intel":
      return "#ff4d6d";
    case "vulnerabilities":
      return "#ff9f43";
    case "government":
      return "#26de81";
    case "ai-security":
      return "#a29bfe";
    case "research":
      return "#74b9ff";
    default:
      return "#00d4ff";
  }
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

const articleRows = (articles: DigestArticle[], siteUrl: string): string =>
  articles
    .map((article) => {
      const href = `${siteUrl.replace(/\/$/, "")}/articles/${article.slug}`;
      return `
      <tr>
        <td style="padding:0 20px 14px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#10101a;border:1px solid rgba(255,255,255,0.08);border-left:4px solid ${categoryColor(article.category)};border-radius:10px;">
            <tr>
              <td style="padding:14px 14px 10px 14px;font-family:Inter,Arial,sans-serif;">
                <div style="font-size:12px;color:#7a7a99;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">${article.category.replace(/-/g, " ")}</div>
                <a href="${href}" style="font-size:18px;line-height:1.3;color:#e8e8f0;text-decoration:none;font-weight:600;">${article.title}</a>
                <p style="margin:10px 0 0 0;font-size:14px;line-height:1.5;color:#c9c9db;">${article.summary}</p>
                <a href="${href}" style="display:inline-block;margin-top:10px;font-size:13px;color:#00d4ff;text-decoration:none;">Read more →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

const buildHtmlDigest = (
  articles: DigestArticle[],
  subscriberEmail: string,
  siteUrl: string
): string => {
  const date = new Date().toUTCString().slice(0, 16);
  const unsubscribeUrl = `${siteUrl.replace(/\/$/, "")}/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0f;color:#e8e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:20px 8px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;">
            <tr>
              <td style="padding:20px;background:#10101a;border:1px solid rgba(255,255,255,0.07);border-radius:12px 12px 0 0;">
                <svg width="130" height="28" viewBox="0 0 130 28" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="7secure">
                  <text x="0" y="20" fill="#00d4ff" font-size="22" font-family="Inter,Arial,sans-serif" font-weight="700">7secure</text>
                </svg>
                <div style="margin-top:8px;font-size:12px;color:#7a7a99;font-family:Inter,Arial,sans-serif;">${date} · Daily Security Briefing</div>
              </td>
            </tr>
            ${articleRows(articles, siteUrl)}
            <tr>
              <td style="padding:18px 20px 24px 20px;background:#10101a;border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 12px 12px;font-family:Inter,Arial,sans-serif;">
                <p style="font-size:12px;line-height:1.5;color:#7a7a99;margin:0;">
                  You are receiving this daily briefing because you subscribed to 7secure.
                  <a href="${unsubscribeUrl}" style="color:#00d4ff;text-decoration:none;">Unsubscribe</a>
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
  subscriberEmail: string,
  siteUrl: string
): string => {
  const lines = [
    `7secure Daily Security Briefing (${new Date().toUTCString()})`,
    ""
  ];

  for (const article of articles) {
    lines.push(`${article.title}`);
    lines.push(`${article.summary}`);
    lines.push(`${siteUrl.replace(/\/$/, "")}/articles/${article.slug}`);
    lines.push("");
  }

  lines.push(
    `Unsubscribe: ${siteUrl.replace(/\/$/, "")}/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`
  );
  return lines.join("\n");
};

export const sendDigest = async (env: WorkerEnv): Promise<DigestSendResult> => {
  const [allArticles, subscribers] = await Promise.all([
    getRecentArticles(env),
    getSubscribers(env)
  ]);

  const digestArticles = pickDigestArticles(allArticles as DigestArticle[]);
  if (!digestArticles.length || !subscribers.length) {
    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: "success"
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const batches: Array<typeof subscribers> = [];
  for (let i = 0; i < subscribers.length; i += 100) {
    batches.push(subscribers.slice(i, i + 100));
  }

  try {
    for (const batch of batches) {
      await resend.batch.send(
        batch.map((subscriber) => ({
          from: env.RESEND_FROM_EMAIL,
          to: [subscriber.email],
          subject: "7secure Daily Security Briefing",
          html: buildHtmlDigest(digestArticles, subscriber.email, env.NEXT_PUBLIC_SITE_URL),
          text: buildTextDigest(digestArticles, subscriber.email, env.NEXT_PUBLIC_SITE_URL)
        }))
      );
    }

    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: "success"
    };
  } catch {
    return {
      articleCount: digestArticles.length,
      subscriberCount: subscribers.length,
      status: "failed"
    };
  }
};
