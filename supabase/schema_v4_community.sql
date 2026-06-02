-- ============================================================
-- MUSCLE YAMATO  schema_v4_community.sql
-- コミュニティ機能（共有・コメント・絵文字リアクション）
-- Supabase SQL Editor で 1回だけ実行してください。
-- 何度実行しても安全（冪等）です。
-- ============================================================

-- ------------------------------------------------------------
-- posts: 共有投稿
--   他メンバーは本人の workouts を直接読めない（RLS）ため、
--   メニュー内容は menu(jsonb) にスナップショットとして保存する。
-- ------------------------------------------------------------
alter table public.posts add column if not exists body_parts   text[];
alter table public.posts add column if not exists menu         jsonb;
alter table public.posts add column if not exists performed_at timestamptz;

-- ------------------------------------------------------------
-- post_reactions: 絵文字リアクション
--   1ユーザーが1投稿につき各絵文字を1回まで押せる
-- ------------------------------------------------------------
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists idx_reactions_post on public.post_reactions(post_id);

alter table public.post_reactions enable row level security;

drop policy if exists "reactions_read_all"   on public.post_reactions;
drop policy if exists "reactions_insert_own" on public.post_reactions;
drop policy if exists "reactions_delete_own" on public.post_reactions;
create policy "reactions_read_all"   on public.post_reactions for select using (true);
create policy "reactions_insert_own" on public.post_reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete_own" on public.post_reactions for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 既存の posts / post_comments の RLS を念のため再確認（冪等）
-- ------------------------------------------------------------
alter table public.posts         enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "posts_read_all"   on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_read_all"   on public.posts for select using (true);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);

drop policy if exists "comments_read_all"   on public.post_comments;
drop policy if exists "comments_insert_own" on public.post_comments;
drop policy if exists "comments_delete_own" on public.post_comments;
create policy "comments_read_all"   on public.post_comments for select using (true);
create policy "comments_insert_own" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.post_comments for delete using (auth.uid() = user_id);

-- 完了
