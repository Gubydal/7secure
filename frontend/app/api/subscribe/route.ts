import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const runtime = "edge";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildWelcomeHtml = (email: string): string => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return `
  <div style="background:#0a0a0f;padding:24px;font-family:Inter,Arial,sans-serif;color:#e8e8f0;">
    <div style="max-width:620px;margin:0 auto;background:#10101a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:22px;">
      <h1 style="margin:0 0 10px 0;color:#00d4ff;">Welcome to 7secure</h1>
      <p style="line-height:1.6;color:#cfcfe0;">Your daily security briefing is now active. Expect one concise update every day with high-signal cybersecurity and AI security news.</p>
      <p style="font-size:13px;color:#8f8fab;">Need to leave anytime? <a style="color:#00d4ff;" href="${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a>.</p>
    </div>
  </div>`;
};

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: existing } = await supabase
      .from("subscribers")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (!existing) {
      await supabase.from("subscribers").insert({
        email,
        confirmed: true,
        unsubscribed_at: null
      });
    } else {
      await supabase
        .from("subscribers")
        .update({ confirmed: true, unsubscribed_at: null })
        .eq("email", email);
    }

    await fetch("https://api.resend.com/audiences/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        email,
        audience_id: process.env.RESEND_AUDIENCE_ID,
        unsubscribed: false
      })
    });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL as string,
      to: [email],
      subject: "Welcome to 7secure — Your daily security briefing 🔐",
      html: buildWelcomeHtml(email)
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to subscribe" }, { status: 500 });
  }
}
