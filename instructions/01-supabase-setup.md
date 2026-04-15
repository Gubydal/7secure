# 01 - Supabase Setup

## Goal
Create the Supabase project, apply the schema, and collect required keys for 7secure.

## Steps
1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Pick your organization, project name, region, and database password.
4. Wait until the project status shows **Healthy**.
5. In the left sidebar, open **SQL Editor**.
6. Click **New query**.
7. Open [supabase/schema.sql](../supabase/schema.sql) from this repository.
8. Copy the full SQL and paste it into Supabase SQL Editor.
9. Click **Run**.
10. Confirm tables exist in **Table Editor**:
   - `articles`
   - `subscribers`
   - `digest_logs`
11. Open **Settings > API**.
12. Copy and save these values for environment variables:
   - **Project URL** -> `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** -> `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Verification
Run this in SQL Editor and confirm counts return `0` (new project):

```sql
select count(*) from articles;
select count(*) from subscribers;
select count(*) from digest_logs;
```
