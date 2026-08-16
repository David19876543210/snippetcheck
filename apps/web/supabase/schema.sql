-- Run this once against a new Supabase project (SQL Editor, or `supabase db push`).
-- RLS is enabled with no policies: only the service role key (used server-side in
-- app/api/waitlist/route.ts) can read or write this table.

create table if not exists report_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  docs_url text not null,
  package_name text,
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  notes text
);

alter table report_requests enable row level security;
