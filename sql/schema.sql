create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'sales' check (role in ('admin', 'sales')),
  phone text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  city text,
  country text default 'Saudi Arabia',
  budget numeric default 0,
  business_background text,
  interested_city text,
  lead_source text,
  status text default 'active',
  pipeline_stage text default 'new_lead',
  assigned_to uuid references public.profiles(id),
  notes text,
  score integer default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_contacted_at timestamptz
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete cascade,
  user_id uuid references public.profiles(id),
  title text not null,
  description text,
  due_date timestamptz not null,
  status text default 'pending' check (status in ('pending', 'done', 'overdue')),
  created_at timestamptz default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete cascade,
  user_id uuid references public.profiles(id),
  meeting_date timestamptz not null,
  notes text,
  objections text,
  next_step text,
  created_at timestamptz default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  city text,
  area text,
  status text default 'open',
  owner_name text,
  opening_date date,
  latitude numeric,
  longitude numeric,
  created_at timestamptz default now()
);

create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  prompt text,
  response text,
  created_at timestamptz default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz default now()
);

create index if not exists investors_assigned_to_idx on public.investors(assigned_to);
create index if not exists investors_created_by_idx on public.investors(created_by);
create index if not exists investors_stage_idx on public.investors(pipeline_stage);
create index if not exists follow_ups_user_due_idx on public.follow_ups(user_id, due_date);
create index if not exists meetings_user_date_idx on public.meetings(user_id, meeting_date);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists investors_set_updated_at on public.investors;
create trigger investors_set_updated_at
before update on public.investors
for each row execute function public.set_updated_at();

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if old.role is distinct from new.role then
      raise exception 'Only admins can change roles';
    end if;
    if old.is_active is distinct from new.is_active then
      raise exception 'Only admins can change activation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text;
begin
  if (select count(*) from public.profiles) = 0 then
    selected_role := 'admin';
  else
    selected_role := 'sales';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    selected_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.investors enable row level security;
alter table public.follow_ups enable row level security;
alter table public.meetings enable row level security;
alter table public.branches enable row level security;
alter table public.ai_logs enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;

create policy profiles_select on public.profiles
for select using (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin on public.profiles
for insert with check (public.is_admin());

create policy profiles_update on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin on public.profiles
for delete using (public.is_admin());

drop policy if exists investors_admin_all on public.investors;
drop policy if exists investors_sales_select on public.investors;
drop policy if exists investors_sales_insert on public.investors;
drop policy if exists investors_sales_update on public.investors;

create policy investors_admin_all on public.investors
for all using (public.is_admin()) with check (public.is_admin());

create policy investors_sales_select on public.investors
for select using (assigned_to = auth.uid() or created_by = auth.uid());

create policy investors_sales_insert on public.investors
for insert with check (created_by = auth.uid());

create policy investors_sales_update on public.investors
for update using (assigned_to = auth.uid() or created_by = auth.uid())
with check (assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists follow_ups_admin_all on public.follow_ups;
drop policy if exists follow_ups_sales_select on public.follow_ups;
drop policy if exists follow_ups_sales_insert on public.follow_ups;
drop policy if exists follow_ups_sales_update on public.follow_ups;
drop policy if exists follow_ups_sales_delete on public.follow_ups;

create policy follow_ups_admin_all on public.follow_ups
for all using (public.is_admin()) with check (public.is_admin());

create policy follow_ups_sales_select on public.follow_ups
for select using (user_id = auth.uid());

create policy follow_ups_sales_insert on public.follow_ups
for insert with check (user_id = auth.uid());

create policy follow_ups_sales_update on public.follow_ups
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy follow_ups_sales_delete on public.follow_ups
for delete using (user_id = auth.uid());

drop policy if exists meetings_admin_all on public.meetings;
drop policy if exists meetings_sales_select on public.meetings;
drop policy if exists meetings_sales_insert on public.meetings;
drop policy if exists meetings_sales_update on public.meetings;
drop policy if exists meetings_sales_delete on public.meetings;

create policy meetings_admin_all on public.meetings
for all using (public.is_admin()) with check (public.is_admin());

create policy meetings_sales_select on public.meetings
for select using (user_id = auth.uid());

create policy meetings_sales_insert on public.meetings
for insert with check (user_id = auth.uid());

create policy meetings_sales_update on public.meetings
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy meetings_sales_delete on public.meetings
for delete using (user_id = auth.uid());

drop policy if exists branches_admin_all on public.branches;
drop policy if exists branches_sales_select on public.branches;

create policy branches_admin_all on public.branches
for all using (public.is_admin()) with check (public.is_admin());

create policy branches_sales_select on public.branches
for select using (auth.uid() is not null);

drop policy if exists ai_logs_admin_all on public.ai_logs;
drop policy if exists ai_logs_own_select on public.ai_logs;
drop policy if exists ai_logs_own_insert on public.ai_logs;

create policy ai_logs_admin_all on public.ai_logs
for all using (public.is_admin()) with check (public.is_admin());

create policy ai_logs_own_select on public.ai_logs
for select using (user_id = auth.uid());

create policy ai_logs_own_insert on public.ai_logs
for insert with check (user_id = auth.uid());

drop policy if exists activity_logs_admin_all on public.activity_logs;
drop policy if exists activity_logs_own_select on public.activity_logs;
drop policy if exists activity_logs_own_insert on public.activity_logs;

create policy activity_logs_admin_all on public.activity_logs
for all using (public.is_admin()) with check (public.is_admin());

create policy activity_logs_own_select on public.activity_logs
for select using (user_id = auth.uid());

create policy activity_logs_own_insert on public.activity_logs
for insert with check (user_id = auth.uid());
