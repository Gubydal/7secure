# 7secure Newsletter System — Audit Report

## Executive Summary

The 7secure newsletter system uses a **Cloudflare Worker (TypeScript)** backend, **Next.js + Supabase** frontend, and **Resend** for email delivery. The task brief references Python/Ghost/Brevo, but those components do not exist in the codebase. All enhancements have been adapted to the actual architecture.

---

## Part 1 — System Audit Findings

### 1.1 — Article Content Pipeline

| Component | Finding | Severity |
|---|---|---|
| **Article Fetching** | Uses **Brave Search API** exclusively (`fetchFeeds` in `rss/fetcher.ts`). The `rss/parser.ts` module exists but is **unused** in the main pipeline. RSS sources are only used to build Brave `site:` query clauses. | Medium |
| **LLM Prompt** | `SYSTEM_PROMPT` in `bridge/writer.ts` has **duplicate/conflicting title instructions** — one for article titles (45–72 chars) and one that accidentally copies newsletter-title logic. The prompt enforces `## Key Points`, `## Description`, `## Why this matters` sections with rigid structure. | High |
| **HTML/Mobiledoc Block** | **No Ghost CMS integration exists**. The system stores Markdown `content` in Supabase. The Next.js frontend renders it via `react-markdown` with Tailwind classes. The email template manually parses Markdown sections and re-renders them as table-based HTML with inline styles. | N/A |
| **Inline Styles (Premailer)** | **No premailer is used**. Email HTML in `email/digest.ts` already uses hand-written inline styles. This works for a Worker environment but there is no single source of truth — web and email renderers are completely separate code paths. | Medium |
| **Rendering Inconsistencies** | **Web view** (`articles/[slug]/page.tsx`) renders via `MarkdownRenderer` with rich Tailwind styling. **Email view** (`email/digest.ts`) extracts sections with regex and outputs simplified HTML with fixed fonts/colors. Section headings, list formatting, and typography differ significantly between contexts. | High |

### 1.2 — Newsletter Title Logic

| Finding | Severity |
|---|---|
| The email subject is **hardcoded** to `"7secure Daily Security Briefing"` in `email/digest.ts:661`. There is **no AI-generated newsletter title**. | High |
| Individual article titles are generated per-article by the LLM, but there is **no synthesis step** that creates a unifying digest title from the day's coverage. | High |
| The `SYSTEM_PROMPT` accidentally includes newsletter-title instructions in the per-article rewrite prompt, causing confusion. | Medium |

### 1.3 — Homepage / Main Page Structure

| Component | Finding |
|---|---|
| **Hero Section** | Subscribe CTA with email capture |
| **Trending Topics** | Category filter pills + search |
| **Latest Articles** | Featured primary article + 3× secondary grid |
| **Best Practices & Tools** | Curated guide cards from `guides` table |
| **Quote Section** | Static CTA |
| **Missing** | No "Snippet of the Week" preview panel. No daily issue concept. No synthesized briefing header. |

### 1.4 — Navigation / Header Menu

| Finding | Current State | Required State |
|---|---|---|
| Header items | Newsletter, Articles, Tools, Practices | **Regulatory Watch**, **Weekly Poll**, **Blog**, **Contact** + existing |
| Footer items | Latest News, Best Practices, Trending Tools, Legal, About, Contact, Sign In | Aligned with new nav |
| Regulatory tag | **Does not exist** | Auto-applied `regulatory-watch` tag |
| Weekly Poll page | **Does not exist** | Static page with embedded poll |
| Blog page | **Does not exist** | Separate from automated articles |

### 1.5 — Additional Issues Found

| Issue | Location | Details |
|---|---|---|
| **Duplicate normalizeArticleUrl** | `cleaner.ts`, `fetcher.ts`, `supabase.ts` | Same URL normalization logic copied in 3 files |
| **Emoji stripping inconsistency** | `writer.ts`, `digest.ts`, `articles/[slug]/page.tsx` | Each file has its own regex/version of emoji stripping |
| **No incident classification** | `writer.ts` | All articles use the same 3-section structure regardless of whether they describe a breach or a policy update |
| **Regulatory content untagged** | Entire pipeline | No mechanism to flag compliance/regulation articles |
| **Static Quick Hits section** | `email/digest.ts:290` | Always shows placeholder text |
| **Missing `contact` page** | `frontend/app/` | Footer links to `/contact` but no route exists |

---

## Part 2 — Enhancement Implementation Plan

1. ✅ Rewrite `SYSTEM_PROMPT` with adaptive incident/non-incident structure
2. ✅ Add `generateNewsletterTitle()` — post-article LLM synthesis call
3. ✅ Add `generateSnippetOfTheWeek()` — teaser hook generator
4. ✅ Add regulatory keyword classifier + auto-tagging
5. ✅ Create shared email/web template helpers for consistency
6. ✅ Update email template with "Snippet of the Week" section + generated title
7. ✅ Update Next.js nav, create missing pages (Blog, Weekly Poll, Contact)
8. ✅ Update article detail page to render incident-style sections
9. ✅ Update Supabase schema for `daily_briefings` table
10. ✅ Provide test checklist
