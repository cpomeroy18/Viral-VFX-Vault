-- Run this first in Supabase SQL Editor (Project > SQL Editor > New query)

create table if not exists effects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  video_link text,
  thumbnail_url text,
  main_tool_used text,           -- comma-separated, e.g. "Masking, Match Cut"
  skill_level text,               -- Easy | Medium | Advanced
  notes text,
  reference_tutorial text,        -- generic technique tutorial link (fallback)
  best_match_tutorial_url text,   -- optional specific-match link, blank by default
  use_case text,                  -- reserved for later, blank for now
  date_added timestamptz default now()
);

create table if not exists vault_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

-- Row Level Security: allow public read on effects, public insert-only on leads
alter table effects enable row level security;
alter table vault_leads enable row level security;

create policy "Public can read effects"
  on effects for select
  using (true);

create policy "Public can add themselves as a lead"
  on vault_leads for insert
  with check (true);
