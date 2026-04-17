import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'edge';

// Initialize Clients directly (skips the old lib)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is missing; subscribe API is using anon key fallback.');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(process.env.RESEND_API_KEY || '');
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '7secure <onboarding@resend.dev>';

export async function POST(req: Request) {
  try {
    const { name, email, interests } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedInterests = Array.isArray(interests)
      ? interests.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
      : [];

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Create or reactivate subscriber so digest query (confirmed=true and unsubscribed_at=null) can include this email.
    const { error: supabaseError } = await supabase
      .from('subscribers')
      .upsert(
        [
          {
            email: normalizedEmail,
            role: normalizedName || null,
            interests: normalizedInterests,
            confirmed: true,
            unsubscribed_at: null
          }
        ],
        {
          onConflict: 'email'
        }
      );

    if (supabaseError) {
      console.error('Supabase Error:', supabaseError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 2. Add to Resend Audience & Send Email (ignoring errors for local testing)
    if (process.env.RESEND_API_KEY) {
      if (process.env.RESEND_AUDIENCE_ID) {
        await fetch('https://api.resend.com/audiences/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            email: normalizedEmail,
            first_name: normalizedName,
            audience_id: process.env.RESEND_AUDIENCE_ID,
            unsubscribed: false
          })
        }).catch(err => console.error('Resend audience error', err));
      }

      await resend.emails.send({
        from: FROM_EMAIL,
        to: [normalizedEmail],
        subject: 'Welcome to 7secure 🛡️',
        html: `
          <div style="background:#09090b;padding:24px;font-family:Inter,Arial,sans-serif;color:#fafafa;">
            <h2>Hi ${normalizedName || 'there'},</h2>
            <p>You're officially on the 7secure list! We're excited to send you the latest in cybersecurity.</p>
            <p>You indicated interest in: <strong>${normalizedInterests.join(', ') || 'General News'}</strong>.</p>
            <br/>
            <p>Stay safe,<br/>The 7secure Team</p>
          </div>
        `,
      }).catch(err => console.error('Resend send error', err));
    }

    return NextResponse.json({ success: true, message: 'Subscription completed' }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
