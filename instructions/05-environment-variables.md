# 05 - Environment Variables

## Complete environment variable matrix

| Variable | Required In | What it does | Where to find the value |
|---|---|---|---|
| `SUPABASE_URL` | Worker, test script | Supabase project API base URL for worker DB access | Supabase > Settings > API > Project URL |
| `SUPABASE_SERVICE_KEY` | Worker, test script | Service role key for worker writes and digest queries | Supabase > Settings > API > service_role key |
| `SUPABASE_SERVICE_ROLE_KEY` | Frontend API routes | Service role key for subscribe/unsubscribe API writes | Supabase > Settings > API > service_role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Public Supabase URL used by server components | Supabase > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Public anon key for read access | Supabase > Settings > API > anon public key |
| `LLM_API_KEY` | Worker, test script | API key for selected OpenAI-compatible LLM provider | Provider dashboard (OpenAI/Anthropic-compatible gateway/etc.) |
| `LLM_BASE_URL` | Worker, test script | Base URL for OpenAI-compatible Chat Completions API | Provider API docs (example format: `https://api.openai.com/v1`) |
| `LLM_MODEL` | Worker, test script | Model ID used for rewrite calls | Provider model list (set to your default model, e.g. GPT-4o) |
| `RESEND_API_KEY` | Worker, frontend API routes, test script | Auth key for sending emails and audience updates | Resend > API Keys |
| `RESEND_FROM_EMAIL` | Worker, frontend API routes, test script | Sender address used for digest and welcome emails | Verified sender from your verified Resend domain |
| `RESEND_AUDIENCE_ID` | Worker, frontend API routes, test script | Audience ID for subscriber sync | Resend > Audiences > select audience |
| `WORKER_SECRET` | Worker trigger clients, test | Bearer secret for protected `/trigger` endpoint | Set your own random string |
| `NEXT_PUBLIC_SITE_URL` | Worker, frontend, test script | Canonical site URL for links/unsubscribe | Your Cloudflare Pages production URL or custom domain |
| `TEST_EMAIL` | test script | Address used for manual test validation | Any email you control |

## Example values file (local development only)
Do not commit secrets.

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_KEY
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
LLM_API_KEY=YOUR_LLM_API_KEY
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=YOUR_MODEL_ID
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=briefing@YOUR_VERIFIED_DOMAIN
RESEND_AUDIENCE_ID=YOUR_RESEND_AUDIENCE_ID
WORKER_SECRET=YOUR_RANDOM_SECRET
NEXT_PUBLIC_SITE_URL=https://7secure.pages.dev
TEST_EMAIL=you@example.com
```
