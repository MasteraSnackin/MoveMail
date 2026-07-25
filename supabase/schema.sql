create extension if not exists pgcrypto;

create table if not exists public.movement_postcards (
  id uuid primary key default gen_random_uuid(),
  to_name text not null check (char_length(to_name) between 1 and 40),
  from_name text not null check (char_length(from_name) between 1 and 40),
  message text not null check (char_length(message) between 1 and 400),
  theme text not null check (theme in ('seaside', 'garden', 'dance')),
  plan jsonb not null,
  provider text not null check (provider in ('openai', 'anthropic', 'demo')),
  created_at timestamptz not null default now()
);

alter table public.movement_postcards enable row level security;
revoke all on table public.movement_postcards from anon, authenticated;
grant all on table public.movement_postcards to service_role;

comment on table public.movement_postcards is
  'Bearer-link movement postcards. Never stores camera frames, pose landmarks or health data.';
