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
  image_url?: string | null;
}

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
      const imageBlock = article.image_url
        ? `
      <tr>
        <td style="padding:14px 14px 0 14px;">
          <img src="${article.image_url}" alt="${article.title}" width="100%" style="display:block;width:100%;max-height:200px;object-fit:cover;border-radius:12px;" />
        </td>
      </tr>`
        : "";
      return `
      <tr>
        <td style="padding:0 20px 14px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#10101a;border:1px solid rgba(255,255,255,0.08);border-left:4px solid ${categoryColor(article.category)};border-radius:10px;">
            ${imageBlock}
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
              <td style="padding:24px 20px 18px;background:#06070c;border:1px solid rgba(255,255,255,0.08);border-radius:14px 14px 0 0;">
                <svg width="130" height="28" viewBox="0 0 130 28" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="7secure">
                  <text x="0" y="20" fill="#00d4ff" font-size="22" font-family="Inter,Arial,sans-serif" font-weight="700">7secure</text>
                </svg>
                <div style="margin-top:10px;font-size:12px;color:#7a7a99;font-family:Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:0.12em;">${date} · Daily Security Briefing</div>
                <div style="margin-top:10px;font-size:24px;line-height:1.2;color:#f2f3f8;font-family:Inter,Arial,sans-serif;font-weight:700;">Cyber news in one clean daily read.</div>
                <div style="margin-top:8px;font-size:14px;line-height:1.55;color:#c9c9db;font-family:Inter,Arial,sans-serif;">Fresh stories, practical guidance, and trending tools - condensed into a block-based digest.</div>
              </td>
            </tr>
            ${articleRows(articles, siteUrl)}
            <tr>
              <td style="padding:18px 20px 24px 20px;background:#10101a;border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 14px 14px;font-family:Inter,Arial,sans-serif;">
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
  console.log(
    `Digest prep: ${digestArticles.length} articles selected for ${subscribers.length} confirmed subscribers`
  );

  if (!digestArticles.length || !subscribers.length) {
    if (!digestArticles.length) {
      console.warn("Digest skipped: no recent articles available to send.");
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
          html: buildHtmlDigest(digestArticles, subscriber.email, env.NEXT_PUBLIC_SITE_URL),
          text: buildTextDigest(digestArticles, subscriber.email, env.NEXT_PUBLIC_SITE_URL)
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
            html: buildHtmlDigest(digestArticles, subscriber.email, env.NEXT_PUBLIC_SITE_URL),
            text: buildTextDigest(digestArticles, subscriber.email, env.NEXT_PUBLIC_SITE_URL)
          });

          if (single.error) {
            console.error(
              `Resend single-send fallback failed for ${subscriber.email}: ${serializeError(single.error)}`
            );
          } else {
            fallbackDelivered += 1;
          }
        }

        console.log(
          `Resend fallback delivered ${fallbackDelivered}/${batch.length} recipients for batch ${batchLabel}`
        );
      } else {
        const accepted = response.data?.data?.length ?? 0;
        console.log(`Resend batch ${batchLabel} accepted ${accepted}/${batch.length} messages`);
        if (accepted < batch.length) {
          hadErrors = true;
          console.error(
            `Resend batch ${batchLabel} accepted fewer messages than requested. Requested=${batch.length}, accepted=${accepted}`
          );
        }
      }
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
