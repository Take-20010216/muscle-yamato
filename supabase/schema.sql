-- ============================================================
-- MUSCLE YAMATO  schema.sql
-- Run this in Supabase SQL Editor (one-shot)
-- ============================================================

-- profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- exercises (user-defined)
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  body_part text not null check (body_part in ('胸','背中','脚','肩','腕','体幹','その他')),
  created_at timestamptz default now()
);
create index if not exists idx_exercises_user on public.exercises(user_id);

-- workouts (one entry per exercise per session)
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_type text not null check (set_type in ('normal','drop','super','no_weight')),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_id_b uuid references public.exercises(id) on delete set null,
  body_part text not null,
  memo text,
  performed_at timestamptz default now()
);
create index if not exists idx_workouts_user_time on public.workouts(user_id, performed_at desc);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  set_index int not null,
  weight numeric not null,
  reps int not null,
  drop_weight numeric,
  drop_reps int,
  weight_b numeric,
  reps_b int
);
create index if not exists idx_sets_workout on public.workout_sets(workout_id);

-- routines
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  position int not null,
  set_type text not null check (set_type in ('normal','drop','super','no_weight')),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_id_b uuid references public.exercises(id) on delete set null,
  target_sets int default 3
);

-- timeline
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  workout_id uuid references public.workouts(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_posts_time on public.posts(created_at desc);

create table if not exists public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_comments_post on public.post_comments(post_id, created_at);

-- ============================================================
-- Personal best view (1セットあたりの max weight*reps)
-- ============================================================
create or replace view public.personal_bests as
select
  w.user_id,
  w.exercise_id,
  s.weight,
  s.reps,
  (case when w.set_type = 'no_weight' then s.reps else s.weight * s.reps end) as score,
  w.set_type,
  w.performed_at as achieved_at
from public.workout_sets s
join public.workouts w on w.id = s.workout_id
where (case when w.set_type = 'no_weight' then s.reps else s.weight * s.reps end) = (
  select max(case when w2.set_type = 'no_weight' then s2.reps else s2.weight * s2.reps end)
  from public.workout_sets s2
  join public.workouts w2 on w2.id = s2.workout_id
  where w2.user_id = w.user_id and w2.exercise_id = w.exercise_id
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.exercises      enable row level security;
alter table public.workouts       enable row level security;
alter table public.workout_sets   enable row level security;
alter table public.routines       enable row level security;
alter table public.routine_items  enable row level security;
alter table public.posts          enable row level security;
alter table public.post_likes     enable row level security;
alter table public.post_comments  enable row level security;

-- profiles: everyone can read, only owner can update
drop policy if exists "profiles_read_all"   on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read_all"   on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- exercises / workouts / routines: owner only (tables that have a user_id column)
do $$
declare t text;
begin
  for t in select unnest(array['exercises','workouts','routines']) loop
    execute format('drop policy if exists "%s_owner_all" on public.%I;', t, t);
    execute format('create policy "%s_owner_all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t, t);
  end loop;
end$$;

-- workout_sets: owner via parent workout
drop policy if exists "sets_owner_all" on public.workout_sets;
create policy "sets_owner_all" on public.workout_sets
  for all
  using ( exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()) )
  with check ( exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()) );

-- routine_items: owner via parent routine
drop policy if exists "ritems_owner_all" on public.routine_items;
create policy "ritems_owner_all" on public.routine_items
  for all
  using ( exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()) )
  with check ( exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()) );

-- posts: read all, write only own
drop policy if exists "posts_read_all"   on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_read_all"   on public.posts for select using (true);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);

-- post_likes: read all, only own row
drop policy if exists "likes_read_all"   on public.post_likes;
drop policy if exists "likes_insert_own" on public.post_likes;
drop policy if exists "likes_delete_own" on public.post_likes;
create policy "likes_read_all"   on public.post_likes for select using (true);
create policy "likes_insert_own" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.post_likes for delete using (auth.uid() = user_id);

-- comments: read all, write only own
drop policy if exists "comments_read_all"   on public.post_comments;
drop policy if exists "comments_insert_own" on public.post_comments;
drop policy if exists "comments_delete_own" on public.post_comments;
create policy "comments_read_all"   on public.post_comments for select using (true);
create policy "comments_insert_own" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.post_comments for delete using (auth.uid() = user_id);

-- ============================================================
-- Trigger: auto-create profile row on signup
-- (the username is taken from auth metadata "username")
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
