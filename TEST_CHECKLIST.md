# 7secure Newsletter System — Test Checklist

## Pre-Flight Checks

- [ ] Run `cd worker && npx wrangler deploy --dry-run` or `npx tsc --noEmit` to confirm no TypeScript errors
- [ ] Run `cd frontend && npm run build` to confirm Next.js build succeeds
- [ ] Verify `worker/src/rss/fetcher.ts` exists (currently imported by `index.ts` but may be missing from repo)

## Database

- [ ] Apply Supabase schema updates: run `supabase/run_this_in_supabase.sql` to add `daily_briefings` table
- [ ] Verify `daily_briefings` upsert works by triggering pipeline once in dev/staging
- [ ] Verify `articles.tags` contains `regulatory-watch` on relevant articles after pipeline run

## Article Content Pipeline

- [ ] Trigger daily pipeline and inspect LLM output for `is_incident` field
- [ ] Verify **incident articles** contain sections: Key Takeaways → Incident Overview → Security Implications → Recommended Mitigations
- [ ] Verify **non-incident articles** contain sections: Key Takeaways → Description → Why It Matters
- [ ] Verify no emojis in titles, summaries, headings, or body text
- [ ] Verify regulatory keywords cause automatic `regulatory-watch` tag injection

## Newsletter Title Generation

- [ ] Confirm title is generated **after** all articles are processed
- [ ] Confirm title is used as Ghost post title and Resend email subject line
- [ ] Verify title does NOT contain: newsletter, digest, roundup, weekly
- [ ] Verify title length ≤ 14 words
- [ ] Verify title uses executive language (risk, exposure, resilience, intelligence, control, trust, breach, threat)

## Snippet of the Week

- [ ] Verify snippet block renders as first content block in email HTML
- [ ] Verify snippet block renders in Ghost post (if injected into post body)
- [ ] Confirm each hook is ≤ 20 words, active voice, no buzzwords
- [ ] Confirm snippet JSON is saved to `daily_briefings` table

## Email / Web Rendering Consistency

- [ ] **Gmail (Web)**: Verify layout, snippet panel, article cards, dividers, emoji headers render correctly
- [ ] **Gmail (Mobile)**: Verify single-column layout, readable text, no horizontal scroll
- [ ] **Outlook Web**: Verify no broken tables, no `position:absolute`, no CSS grid/flex issues
- [ ] **Apple Mail**: Verify images, borders, rounded corners render correctly
- [ ] Verify `buildHtmlDigest` uses table-based layout (no `display:grid`, limited `display:flex`)
- [ ] Confirm `buildArticleScript` extracts both old and new section names for backward compatibility

## Ghost Frontend

- [ ] Verify navigation shows: Newsletter, Articles, Blog, Weekly Poll, Tools, Practices, Contact
- [ ] Verify `/blog` page loads and lists articles
- [ ] Verify `/weekly-poll` page loads with poll UI
- [ ] Verify `/contact` page loads with contact cards
- [ ] Verify `/articles/[slug]` renders incident sections when `is_incident` is true
- [ ] Verify `/articles/[slug]` renders non-incident sections otherwise
- [ ] Verify regulatory articles display `regulatory-watch` tag

## Resend / Brevo Email Delivery

- [ ] Confirm `sendDigest` passes `newsletterTitle` as email subject
- [ ] Confirm `sendDigest` passes `snippets` into HTML body
- [ ] Verify fallback single-send path also uses new title + snippets
- [ ] Confirm `markDigestArticlesSent` still prevents duplicate sends

## Security & Error Handling

- [ ] Verify snippet generation falls back to generic hooks on LLM timeout/error
- [ ] Verify title generation falls back to `Daily Security Intelligence Brief` on LLM timeout/error
- [ ] Confirm `AbortController` timeout is respected for all LLM calls (45s for snippets/title, 75s for articles)

## Rollback Plan

- [ ] Keep previous `SYSTEM_PROMPT` commented in `writer.ts` or in git history for quick rollback
- [ ] Monitor first 3 production pipeline runs for title quality and snippet accuracy
- [ ] If title quality is poor, disable `generateNewsletterTitle` and hardcode subject line temporarily
