-- 7secure safe bootstrap/migration script
-- Run this in Supabase SQL Editor once.
-- It is idempotent and does NOT drop existing data.

begin;

create extension if not exists pgcrypto;

-- ARTICLES
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  summary text,
  content text,
  category text,
  source_name text,
  source_url text,
  original_url text,
  image_url text,
  is_featured boolean default false,
  tags text[] default '{}',
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.articles add column if not exists slug text;
alter table public.articles add column if not exists title text;
alter table public.articles add column if not exists summary text;
alter table public.articles add column if not exists content text;
alter table public.articles add column if not exists category text;
alter table public.articles add column if not exists source_name text;
alter table public.articles add column if not exists source_url text;
alter table public.articles add column if not exists original_url text;
alter table public.articles add column if not exists image_url text;
alter table public.articles add column if not exists is_featured boolean default false;
alter table public.articles add column if not exists tags text[] default '{}';
alter table public.articles add column if not exists published_at timestamptz default now();
alter table public.articles add column if not exists created_at timestamptz default now();

create unique index if not exists idx_articles_slug_unique on public.articles(slug);
create index if not exists idx_articles_published_at on public.articles(published_at desc);
create index if not exists idx_articles_category on public.articles(category);

-- SUBSCRIBERS
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text,
  interests text[] default '{}',
  confirmed boolean default true,
  unsubscribed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.subscribers add column if not exists email text;
alter table public.subscribers add column if not exists role text;
alter table public.subscribers add column if not exists interests text[] default '{}';
alter table public.subscribers add column if not exists confirmed boolean default true;
alter table public.subscribers add column if not exists unsubscribed_at timestamptz;
alter table public.subscribers add column if not exists created_at timestamptz default now();

create unique index if not exists idx_subscribers_email on public.subscribers(email);

-- DIGEST LOGS
create table if not exists public.digest_logs (
  id uuid primary key default gen_random_uuid(),
  article_count int,
  subscriber_count int,
  status text,
  created_at timestamptz default now()
);

alter table public.digest_logs add column if not exists article_count int;
alter table public.digest_logs add column if not exists subscriber_count int;
alter table public.digest_logs add column if not exists status text;
alter table public.digest_logs add column if not exists created_at timestamptz default now();

-- DIGEST FEEDBACK
create table if not exists public.digest_feedback (
  id uuid primary key default gen_random_uuid(),
  email text,
  rating smallint,
  context text default 'daily_digest_email',
  feedback_source text default 'email_star_click',
  user_agent text,
  created_at timestamptz default now()
);

alter table public.digest_feedback add column if not exists email text;
alter table public.digest_feedback add column if not exists rating smallint;
alter table public.digest_feedback add column if not exists context text default 'daily_digest_email';
alter table public.digest_feedback add column if not exists feedback_source text default 'email_star_click';
alter table public.digest_feedback add column if not exists user_agent text;
alter table public.digest_feedback add column if not exists created_at timestamptz default now();

-- Keep rating constrained if the constraint does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'digest_feedback_rating_check'
  ) then
    alter table public.digest_feedback
      add constraint digest_feedback_rating_check
      check (rating between 1 and 5);
  end if;
end $$;

create index if not exists idx_digest_feedback_email on public.digest_feedback(email);
create index if not exists idx_digest_feedback_source on public.digest_feedback(feedback_source);

-- SENT ARTICLE HISTORY (prevents resend duplicates)
create table if not exists public.digest_sent_articles (
  article_slug text primary key,
  sent_at timestamptz not null default now()
);

alter table public.digest_sent_articles add column if not exists article_slug text;
alter table public.digest_sent_articles add column if not exists sent_at timestamptz default now();

create index if not exists idx_digest_sent_articles_sent_at on public.digest_sent_articles(sent_at desc);

-- RLS + policies
alter table public.articles enable row level security;
alter table public.subscribers enable row level security;
alter table public.digest_logs enable row level security;
alter table public.digest_feedback enable row level security;
alter table public.digest_sent_articles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'articles' and policyname = 'Public read articles'
  ) then
    create policy "Public read articles"
      on public.articles
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'articles' and policyname = 'Service role full access articles'
  ) then
    create policy "Service role full access articles"
      on public.articles
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscribers' and policyname = 'Service role full access subscribers'
  ) then
    create policy "Service role full access subscribers"
      on public.subscribers
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'digest_logs' and policyname = 'Service role full access digest_logs'
  ) then
    create policy "Service role full access digest_logs"
      on public.digest_logs
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'digest_feedback' and policyname = 'Service role full access digest_feedback'
  ) then
    create policy "Service role full access digest_feedback"
      on public.digest_feedback
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'digest_sent_articles' and policyname = 'Service role full access digest_sent_articles'
  ) then
    create policy "Service role full access digest_sent_articles"
      on public.digest_sent_articles
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

commit;
