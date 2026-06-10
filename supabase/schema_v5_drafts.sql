-- =============================================================
-- v5: 入力フォームの下書き(自動保存)をサーバー側に保持するテーブル
--   - iOSのホーム画面PWAは localStorage が揮発することがあるため、
--     確実に残すよう Supabase にも保存する。
--   - 1ユーザー × key(=画面種別) ごとに1行。upsertで上書き。
-- =============================================================

create table if not exists public.drafts (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,                 -- 例: 'record' / 'record:routine:<id>'
  data       jsonb       not null,                 -- 入力内容のスナップショット
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.drafts enable row level security;

-- 自分の下書きだけ読み書きできる
drop policy if exists "drafts_select_own" on public.drafts;
create policy "drafts_select_own" on public.drafts
  for select using (auth.uid() = user_id);

drop policy if exists "drafts_insert_own" on public.drafts;
create policy "drafts_insert_own" on public.drafts
  for insert with check (auth.uid() = user_id);

drop policy if exists "drafts_update_own" on public.drafts;
create policy "drafts_update_own" on public.drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "drafts_delete_own" on public.drafts;
create policy "drafts_delete_own" on public.drafts
  for delete using (auth.uid() = user_id);
