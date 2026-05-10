export type SetType = "normal" | "drop" | "super";
export type BodyPart = "胸" | "背中" | "脚" | "肩" | "腕" | "体幹" | "その他";

export const BODY_PARTS: BodyPart[] = ["胸", "背中", "脚", "肩", "腕", "体幹", "その他"];

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  body_part: BodyPart;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  set_index: number;
  weight: number;
  reps: number;
  drop_weight: number | null;
  drop_reps: number | null;
  weight_b: number | null;
  reps_b: number | null;
};

export type Workout = {
  id: string;
  user_id: string;
  set_type: SetType;
  exercise_id: string;
  exercise_id_b: string | null;
  body_part: BodyPart;
  memo: string | null;
  performed_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type RoutineItem = {
  id: string;
  routine_id: string;
  position: number;
  set_type: SetType;
  exercise_id: string;
  exercise_id_b: string | null;
  target_sets: number;
};

export type Post = {
  id: string;
  user_id: string;
  body: string;
  workout_id: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: "NORMAL SET",
  drop: "DROP SET",
  super: "SUPER SET",
};

export const SET_TYPE_HINTS: Record<SetType, string> = {
  normal: "通常のセットを記録します",
  drop: "1段目→2段目（重量を落として続行）を1セットとして記録します",
  super: "種目A→種目Bを連続で行うセットを記録します",
};
