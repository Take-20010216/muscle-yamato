-- ============================================================
-- MUSCLE YAMATO  schema_v3_assist.sql
-- 各セットに「補助あり」フラグを追加（idempotent）
-- ============================================================

alter table public.workout_sets
  add column if not exists has_assist boolean not null default false;
