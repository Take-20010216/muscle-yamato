-- ============================================================
-- MUSCLE YAMATO  schema_v2.sql
-- フェーズ2: 部位を配列化 / set_typeをセット単位 / dropをN段化 / routineに部位
--
-- 既存の workouts / workout_sets / routines / routine_items は全消し
-- 何度実行しても通るようidempotentに記述
-- ============================================================

-- 0) ビュー削除（後で再作成）
drop view if exists public.personal_bests cascade;

-- 1) 既存データを全消し
truncate table public.workout_sets, public.workouts, public.routine_items, public.routines restart identity cascade;

-- 2) exercises.body_part 制約を新部位に更新（順序重要：制約DROP → UPDATE → 制約ADD）
alter table public.exercises drop constraint if exists exercises_body_part_check;
update public.exercises set body_part = '上腕二頭筋' where body_part = '腕';
update public.exercises set body_part = '全身' where body_part in ('体幹','その他');
-- 万が一それでも未知の値が残ってたら '全身' に寄せる
update public.exercises set body_part = '全身'
  where body_part not in ('胸','肩','背中','上腕二頭筋','上腕三頭筋','脚','全身');
alter table public.exercises add constraint exercises_body_part_check
  check (body_part in ('胸','肩','背中','上腕二頭筋','上腕三頭筋','脚','全身'));

-- 3) workouts: set_type / body_part 廃止 → body_parts 配列に
alter table public.workouts drop constraint if exists workouts_set_type_check;
alter table public.workouts drop column if exists set_type;
alter table public.workouts drop column if exists body_part;

alter table public.workouts add column if not exists body_parts text[] not null default array[]::text[];
alter table public.workouts drop constraint if exists workouts_body_parts_check;
alter table public.workouts add constraint workouts_body_parts_check
  check (
    array_length(body_parts, 1) between 1 and 3
    and body_parts <@ array['胸','肩','背中','上腕二頭筋','上腕三頭筋','脚','全身']
  );

-- 4) workout_sets:
--    廃止: drop_weight / drop_reps
--    追加: set_type (normal/drop/super/no_weight), drops jsonb (N段ドロップ)
--    据置: weight_b / reps_b（super set用）
alter table public.workout_sets drop column if exists drop_weight;
alter table public.workout_sets drop column if exists drop_reps;

alter table public.workout_sets add column if not exists set_type text not null default 'normal';
alter table public.workout_sets drop constraint if exists workout_sets_set_type_check;
alter table public.workout_sets add constraint workout_sets_set_type_check
  check (set_type in ('normal','drop','super','no_weight'));

alter table public.workout_sets add column if not exists drops jsonb not null default '[]'::jsonb;

-- 5) routines: body_parts を追加
alter table public.routines add column if not exists body_parts text[] default array[]::text[];
alter table public.routines drop constraint if exists routines_body_parts_check;
alter table public.routines add constraint routines_body_parts_check
  check (
    body_parts is null
    or array_length(body_parts, 1) is null
    or (
      array_length(body_parts, 1) between 1 and 3
      and body_parts <@ array['胸','肩','背中','上腕二頭筋','上腕三頭筋','脚','全身']
    )
  );

-- 6) routine_items: set_type 廃止（セット単位は記録側で決める）
alter table public.routine_items drop constraint if exists routine_items_set_type_check;
alter table public.routine_items drop column if exists set_type;

-- 7) personal_bests ビュー再作成（set_type は workout_sets から取得）
create or replace view public.personal_bests as
select
  w.user_id,
  w.exercise_id,
  s.weight,
  s.reps,
  (case when s.set_type = 'no_weight' then s.reps else s.weight * s.reps end) as score,
  s.set_type,
  w.performed_at as achieved_at
from public.workout_sets s
join public.workouts w on w.id = s.workout_id
where (case when s.set_type = 'no_weight' then s.reps else s.weight * s.reps end) = (
  select max(case when s2.set_type = 'no_weight' then s2.reps else s2.weight * s2.reps end)
  from public.workout_sets s2
  join public.workouts w2 on w2.id = s2.workout_id
  where w2.user_id = w.user_id and w2.exercise_id = w.exercise_id
);
