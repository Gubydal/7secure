import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await supabase
      .from("subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", email);

    await fetch("https://api.resend.com/audiences/contacts/remove", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        audience_id: process.env.RESEND_AUDIENCE_ID,
        email
      })
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to unsubscribe" }, { status: 500 });
  }
}
