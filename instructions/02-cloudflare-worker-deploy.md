# 02 - Cloudflare Worker Deploy

## Goal
Deploy the 7secure automation worker with cron + trigger endpoint.

## Prerequisites
- Node.js 20+
- npm installed
- Cloudflare account

## Steps
1. Install Wrangler globally:

```bash
npm install -g wrangler
```

2. Authenticate:

```bash
wrangler login
```

3. Move to worker directory:

```bash
cd worker
npm install
```

4. Add worker secrets (run each command and paste value when prompted):

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put LLM_API_KEY
wrangler secret put LLM_BASE_URL
wrangler secret put LLM_MODEL
wrangler secret put BRAVE_SEARCH_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_EMAIL
wrangler secret put RESEND_AUDIENCE_ID
wrangler secret put WORKER_SECRET
wrangler secret put NEXT_PUBLIC_SITE_URL
```

5. Deploy:

```bash
wrangler deploy
```

6. Copy deployed worker URL from terminal output.

## Manual trigger test
Use your worker URL and secret:

```bash
curl -X POST "https://<your-worker>.workers.dev/trigger" \
  -H "Authorization: Bearer <WORKER_SECRET>"
```

Expected response:

```json
{"success":true}
```

## Cron verification
- Open Cloudflare Dashboard > Workers & Pages > 7secure-worker.
- Confirm cron trigger exists: `0 7 * * *` (7:00 AM UTC daily).
