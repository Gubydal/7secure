import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const runtime = "edge";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscribers")
      .select("email,confirmed,unsubscribed_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("Login lookup failed:", error.message);
      return NextResponse.json({ success: false, error: "Unable to login" }, { status: 500 });
    }

    if (!data || !data.confirmed || data.unsubscribed_at) {
      return NextResponse.json(
        { success: false, error: "No active subscription found for this email." },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
