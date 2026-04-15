# 04 - Cloudflare Pages Deploy

## Goal
Deploy the Next.js 15 frontend to Cloudflare Pages using next-on-pages.

## Steps
1. Push this repository to GitHub.
2. Open Cloudflare Dashboard > **Workers & Pages** > **Create application** > **Pages**.
3. Click **Connect to Git** and select your GitHub repo.
4. Configure build settings:
   - Framework preset: **None**
   - Build command: `npx @cloudflare/next-on-pages`
   - Build output directory: `.vercel/output/static`
   - Root directory: `frontend`
5. In **Settings > Environment variables**, add all frontend environment variables (see [05-environment-variables.md](./05-environment-variables.md)).
6. Save and trigger first deployment.
7. After deploy completes, open the production URL and verify:
   - Homepage loads
   - Article page loads
   - Subscribe page works
   - Unsubscribe page works

## Recommended compatibility settings
- Node.js version: 20+
- Keep `NODE_ENV=production`

## Redeploy after changes
Any new push to your connected branch triggers automatic redeploy.
