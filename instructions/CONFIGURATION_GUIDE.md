# 7secure Configuration & Deployment Guide

This guide details exactly what you need to configure in the dashboards of Supabase, Resend, Cloudflare, and your LLM provider to get 7secure fully live.

## 1. Supabase (Database & Auth)
We need Supabase to store our newsletter subscribers and the curated articles.

**Dashboard Steps:**
1. Go to [Supabase](https://supabase.com/) and click **New Project**.
2. Give it a name (e.g., `7secure`) and a secure database password. Wait for the database to provision.
3. On the left sidebar, click **SQL Editor** -> **New Query**.
4. Paste the entire contents of your `supabase/schema.sql` file here and click **Run**. This creates your tables and row-level security policies.
5. On the left sidebar, go to **Settings** (gear icon at the bottom) -> **API**.
6. Copy the following values to your notepad:
   * **Project URL**
   * **Project API Keys -> `anon`** `public` 
   * **Project API Keys -> `service_role`** `secret` (keep this very safe!)

## 2. Resend (Email Delivery)
Resend will manage our subscriber audience and send the actual daily newsletters.

**Dashboard Steps:**
1. Go to [Resend](https://resend.com/) and create an account.
2. **Verify your Domain:** Go to **Domains** on the left menu -> **Add Domain**. Follow their instructions to add the provided TXT/MX records to your DNS provider (e.g., Cloudflare, Namecheap). *Emails will go to spam if you skip this!*
3. **Create an API Key:** Go to **API Keys** -> **Create API Key**. Give it "Full Access" and copy the key to your notepad.
4. **Set Up an Audience:** Go to **Audiences** -> **Create Audience**. Name it "7secure Subscribers". Once created, copy the **Audience ID** (a long string of characters) to your notepad.

## 3. LongCat (LLM Processing)
Since this is an AI newsletter, we originally used OpenAI but shifted to LongCat-Flash-Thinking-2601 seamlessly! 

**Dashboard Steps:**
1. Just make sure you grab your LongCat API Key. 

*Your worker code has already been updated to communicate with `https://api.longcat.chat/openai/v1` and specifically requested the `LongCat-Flash-Thinking-2601` model.*

## 4. Applying the Configurations

Now that you have all your keys, you need to provide them to the Frontend and the Backend Worker.

### A. Frontend (Next.js App)
Create a `.env.local` file in your `frontend/` directory (if it doesn't exist) and add:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```
*(If you are ready to deploy to Cloudflare Pages, you will also add these exact variables in the Cloudflare Dashboard under **Pages -> Settings -> Environment variables**).*

### B. Backend (Cloudflare Worker)
Open your `worker/wrangler.toml` file. Ensure the plain text variables match your environment. 
For secrets, open your VS Code terminal and run the following commands inside the `worker` directory. It will prompt you to paste the values:

```bash
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_AUDIENCE_ID
npx wrangler secret put LLM_API_KEY
npx wrangler secret put BRAVE_SEARCH_API_KEY
```

## Summary Checklist for the AI (Provide these back to me when ready!):
If you want me to help you apply these, provide me with:
- [ ] Your Supabase URL and Anon Key (safe to share).
- *Note: Keep your Service Role Key, Resend API Key, and OpenAI keys private. I will guide you on how to inject them locally securely if needed.*