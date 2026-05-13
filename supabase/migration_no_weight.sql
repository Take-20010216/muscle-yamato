-- ============================================================
-- 既存DBに NO_WEIGHT セットタイプを追加するマイグレーション
-- Supabase SQL Editor で一度だけ実行してください
-- ============================================================

-- workouts.set_type の CHECK制約を更新
alter table public.workouts drop constraint if exists workouts_set_type_check;
alter table public.workouts add constraint workouts_set_type_check
  check (set_type in ('normal', 'drop', 'super', 'no_weight'));

-- routine_items.set_type の CHECK制約を更新
alter table public.routine_items drop constraint if exists routine_items_set_type_check;
alter table public.routine_items add constraint routine_items_set_type_check
  check (set_type in ('normal', 'drop', 'super', 'no_weight'));

-- personal_bests ビューを no_weight 対応に更新
-- no_weight の場合: スコア = reps（最大回数）
-- それ以外: スコア = weight * reps
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
