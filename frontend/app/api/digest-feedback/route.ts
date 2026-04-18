import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const runtime = "edge";

const parseRating = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
};

const normalizeEmail = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }

  return email;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rating = parseRating(url.searchParams.get("rating"));
  const email = normalizeEmail(url.searchParams.get("email"));
  const context = (url.searchParams.get("context") || "daily_digest_email").slice(0, 80);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/$/, "");
  const redirectUrl = new URL(`${siteUrl}/feedback/thanks`);

  if (rating) {
    redirectUrl.searchParams.set("rating", String(rating));
  }

  if (!rating || !email) {
    redirectUrl.searchParams.set("saved", "0");
    return NextResponse.redirect(redirectUrl.toString(), 302);
  }

  let saved = false;
  try {
    const supabase = getSupabaseAdmin();
    const basePayload = {
      email,
      rating,
      context
    };

    const enhancedPayload = {
      ...basePayload,
      feedback_source: "email_star_click",
      user_agent: (request.headers.get("user-agent") || "unknown").slice(0, 512)
    };

    let { error } = await supabase.from("digest_feedback").insert(enhancedPayload);

    if (error && /column|feedback_source|user_agent/i.test(error.message)) {
      const fallbackInsert = await supabase.from("digest_feedback").insert(basePayload);
      error = fallbackInsert.error;
    }

    if (error) {
      console.error("Digest feedback insert error:", error.message);
    } else {
      saved = true;
    }
  } catch (error) {
    console.error("Digest feedback handler error:", error);
  }

  redirectUrl.searchParams.set("saved", saved ? "1" : "0");

  return NextResponse.redirect(redirectUrl.toString(), 302);
}
