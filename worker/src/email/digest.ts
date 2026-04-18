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

const resolveImageUrl = (imageUrl: string | null | undefined, siteBase: string): string | null => {
  const raw = (imageUrl || "").trim();
  if (!raw) {
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

const buildDailyRundownList = (articles: DigestArticle[], siteBase: string): string =>
  articles
    .map((article) => {
      const fallback = `${siteBase}/articles/${article.slug}`;
      const href = safeUrl(article.original_url, fallback);
      return `<li style="margin:0 0 10px 0;"><a href="${href}" style="color:#8ea2ff;text-decoration:underline;font-weight:600;">${escapeHtml(article.title)}</a></li>`;
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
        ? `<tr><td style="padding:12px 14px 0 14px;"><img src="${imageSrc}" alt="${title}" width="100%" style="display:block;width:100%;height:auto;max-height:210px;object-fit:cover;border-radius:8px;" /></td></tr>`
        : "";

      return `
      <tr>
        <td style="padding:${index === 0 ? "0" : "14px 0 0 0"};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #2a2e3f;border-radius:10px;">
            ${imageBlock}
            <tr>
              <td style="padding:14px 14px 14px 14px;font-family:Inter,Arial,sans-serif;color:#e8ecf8;">
                <div style="font-size:11px;letter-spacing:0.11em;text-transform:uppercase;color:#97a1c4;margin-bottom:8px;">${category}</div>
                <a href="${originalHref}" style="font-size:30px;line-height:1.24;font-weight:700;color:#8ea2ff;text-decoration:underline;display:block;">${title}</a>
                <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:#d4daee;"><strong style="color:#eef2ff;">Why this matters:</strong> ${whyItMatters}</p>
                <p style="margin:12px 0 0 0;font-size:15px;line-height:1.64;color:#c8d0ea;">${preview}</p>
                <p style="margin:12px 0 0 0;font-size:12px;line-height:1.4;color:#98a2bd;">${formatPublishDate(article.published_at)} · <a href="${newsletterHref}" style="color:#9ec8ff;text-decoration:underline;">Read 7secure version</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

const buildQuickHitsSection = (): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #2a2e3f;border-radius:10px;">
    <tr>
      <td style="padding:14px 14px 12px 14px;font-family:Inter,Arial,sans-serif;">
        <a href="#" style="font-size:18px;line-height:1.35;font-weight:700;color:#8ea2ff;text-decoration:underline;display:block;">🛠️ Trending Tools</a>
        <ul style="margin:10px 0 0 18px;padding:0;color:#d2d8ec;font-size:15px;line-height:1.7;">
          <li>Tool highlights will appear here in the next digest.</li>
        </ul>
      </td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #2a2e3f;border-radius:10px;margin-top:12px;">
    <tr>
      <td style="padding:14px 14px 12px 14px;font-family:Inter,Arial,sans-serif;">
        <a href="#" style="font-size:18px;line-height:1.35;font-weight:700;color:#8ea2ff;text-decoration:underline;display:block;">🛡️ Security Practices</a>
        <ul style="margin:10px 0 0 18px;padding:0;color:#d2d8ec;font-size:15px;line-height:1.7;">
          <li>Practice snapshots are being prepared for this section.</li>
        </ul>
      </td>
    </tr>
  </table>`;

const buildRatingSection = (subscriberEmail: string, siteBase: string): string => {
  const encodedEmail = encodeURIComponent(subscriberEmail);
  const feedbackLink = (rating: number): string =>
    `${siteBase}/api/digest-feedback?email=${encodedEmail}&rating=${rating}`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #2a2e3f;border-radius:10px;">
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
  const coverImage = resolveImageUrl(articles[0]?.image_url || "/cover.avif", siteBase) || `${siteBase}/cover.avif`;
  const dailyRundownList = buildDailyRundownList(articles, siteBase);
  const latestDevelopmentCards = buildLatestDevelopmentCards(articles, siteBase);
  const ratingSection = buildRatingSection(subscriber.email, siteBase);
  const quickHits = buildQuickHitsSection();

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
          <table class="digest-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;background:#0f121b;border:1px solid #2c3144;border-radius:12px;overflow:hidden;">
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
                <img src="${coverImage}" alt="7secure cover" width="100%" style="display:block;width:100%;height:auto;max-height:230px;object-fit:cover;border-radius:8px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;font-family:Inter,Arial,sans-serif;">
                <table class="digest-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#11131b;border:1px solid #2a2e3f;border-radius:10px;">
                  <tr>
                    <td class="digest-copy" style="padding:16px;color:#e8ecf8;">
                      <p style="margin:0;font-size:32px;line-height:1.3;font-weight:700;">Good morning, ${subscriberName}.</p>
                      <p style="margin:12px 0 0 0;font-size:16px;line-height:1.68;color:#cdd5ec;">${date} briefing: clear threat context, key developments, and quick actions worth prioritizing today.</p>
                      <p style="margin:16px 0 0 0;font-size:28px;line-height:1.28;font-weight:700;">In today's security rundown:</p>
                      <ul style="margin:12px 0 0 20px;padding:0;color:#d6ddf4;font-size:22px;line-height:1.65;">
                        ${dailyRundownList}
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px 0 16px;font-family:Inter,Arial,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#000000;border:1px solid #2a2e3f;">
                  <tr><td style="padding:10px 14px;text-align:center;font-size:42px;line-height:1.2;font-weight:700;color:#f0f4ff;letter-spacing:0.03em;">LATEST DEVELOPMENTS</td></tr>
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
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#000000;border:1px solid #2a2e3f;">
                  <tr><td style="padding:10px 14px;text-align:center;font-size:42px;line-height:1.2;font-weight:700;color:#f0f4ff;letter-spacing:0.03em;">QUICK HITS</td></tr>
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
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#0f1118;border:1px solid #2a2e3f;border-radius:10px;">
                  <tr>
                    <td style="padding:16px;">
                      <p style="margin:0;font-size:15px;line-height:1.7;color:#d4dbf2;">See you soon,</p>
                      <p style="margin:8px 0 0 0;font-size:15px;line-height:1.7;color:#d4dbf2;"><em>The humans behind 7secure</em></p>
                      <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:#9ba8c8;">
                        <a href="${siteBase}" style="color:#9ec8ff;text-decoration:underline;">Website</a>
                        <span style="color:#596281;"> · </span>
                        <a href="https://x.com" style="color:#9ec8ff;text-decoration:underline;">X</a>
                        <span style="color:#596281;"> · </span>
                        <a href="https://linkedin.com" style="color:#9ec8ff;text-decoration:underline;">LinkedIn</a>
                        <span style="color:#596281;"> · </span>
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
