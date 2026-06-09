-- Claude SEO Outreach Portal — Supabase schema.
-- Run in the Supabase SQL editor (or via the CLI) on your project.
--
-- Two tables: outreach_scans (one row per scan) and outreach_emails (one row
-- per sent email, optionally linked to a scan). RLS is enabled; the app writes
-- with the service-role key from the server, and authenticated users can read
-- their own rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Scans
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_scans (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  target_url         text not null,
  business_name      text not null,
  city               text not null,
  mode               text not null check (mode in ('lite', 'full', 'proof')),
  detected_keyword   text,
  map_pack_position  integer,
  findings           jsonb not null default '{}'::jsonb,
  warnings           jsonb not null default '[]'::jsonb
);

create index if not exists outreach_scans_created_by_idx
  on public.outreach_scans (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- Sent emails
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_emails (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null,
  scan_id      uuid references public.outreach_scans (id) on delete set null,
  recipient    text not null,
  subject      text not null,
  body         text not null,
  message_id   text,
  status       text not null default 'sent' check (status in ('sent', 'failed', 'draft'))
);

create index if not exists outreach_emails_created_by_idx
  on public.outreach_emails (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.outreach_scans  enable row level security;
alter table public.outreach_emails enable row level security;

-- Authenticated users can read their own rows. Inserts happen via the
-- service-role key (which bypasses RLS), so no insert policy is needed for the
-- app; add one if you later write from the client.
drop policy if exists "scans: read own" on public.outreach_scans;
create policy "scans: read own"
  on public.outreach_scans for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "emails: read own" on public.outreach_emails;
create policy "emails: read own"
  on public.outreach_emails for select
  to authenticated
  using (created_by = auth.uid());
