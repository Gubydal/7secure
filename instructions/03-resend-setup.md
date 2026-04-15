# 03 - Resend Setup

## Goal
Set up Resend for welcome emails and daily digest delivery.

## Steps
1. Go to https://resend.com and create/sign in to your account.
2. In Resend dashboard, open **Domains**.
3. Click **Add domain** and enter your sending domain (example: `mail.yourdomain.com`).
4. Add all DNS records Resend asks for (SPF, DKIM, and verification records) in your DNS provider.
5. Wait until domain status shows **Verified**.
6. Open **API Keys** and click **Create API Key**.
7. Name it (example: `7secure-production`) and copy the key.
8. Save it as `RESEND_API_KEY`.
9. Open **Audiences**.
10. Click **Create audience** (example: `7secure-subscribers`).
11. Copy audience ID and save as `RESEND_AUDIENCE_ID`.
12. Choose sender email on verified domain (example: `briefing@mail.yourdomain.com`) and save as `RESEND_FROM_EMAIL`.

## Critical checks
- `RESEND_FROM_EMAIL` must be from your verified domain.
- If domain is not verified, email sending fails.
- Keep `RESEND_API_KEY` private.
