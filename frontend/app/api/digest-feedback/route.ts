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

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/$/, "");
  const redirectUrl = new URL(`${siteUrl}/`);

  if (rating) {
    redirectUrl.searchParams.set("feedback", "thanks");
    redirectUrl.searchParams.set("rating", String(rating));
  }

  if (!rating || !email) {
    return NextResponse.redirect(redirectUrl.toString(), 302);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("digest_feedback").insert({
      email,
      rating,
      context: "daily_digest_email"
    });

    if (error) {
      console.error("Digest feedback insert error:", error.message);
    }
  } catch (error) {
    console.error("Digest feedback handler error:", error);
  }

  return NextResponse.redirect(redirectUrl.toString(), 302);
}
