-- Extends auth.users (managed by Supabase Auth) with app-specific Pro-tier
-- state. Milestone P1 scope only — chains/gear_vault/public_chain_pages
-- tables are added in later milestones (P2, P3, P5) per the approved plan.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  is_pro boolean not null default false,
  pro_since timestamptz,
  pro_plan text check (pro_plan in ('annual', 'lifetime')),
  lemon_squeezy_customer_id text,
  lemon_squeezy_subscription_id text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.uid() = id);

-- Deliberately no update/insert/delete policy for the authenticated role.
-- Every column on this table (is_pro, pro_since, pro_plan, the Lemon Squeezy
-- ids) is server-only state: it's written by the handle_new_user trigger
-- below and, from Milestone P4 on, by the Lemon Squeezy webhook using the
-- service role key, which bypasses RLS entirely. If a client-editable profile
-- field is ever added (display name, etc.), give it a narrow update policy
-- with an explicit column list — not a blanket "auth.uid() = id" grant like
-- an earlier draft of this migration had, which would let a signed-in user
-- set their own is_pro to true directly.

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
