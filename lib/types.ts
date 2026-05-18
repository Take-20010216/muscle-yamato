export type SetType = "normal" | "drop" | "super" | "no_weight";
export type BodyPart =
  | "胸"
  | "肩"
  | "背中"
  | "上腕二頭筋"
  | "上腕三頭筋"
  | "脚"
  | "全身";

export const BODY_PARTS: BodyPart[] = [
  "胸",
  "肩",
  "背中",
  "上腕二頭筋",
  "上腕三頭筋",
  "脚",
  "全身",
];

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

// ドロップセットの各段 (重量・回数)
export type DropStage = {
  weight: number;
  reps: number;
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  set_index: number;
  set_type: SetType;            // セット単位
  weight: number;
  reps: number;
  drops: DropStage[];           // N段ドロップ ([] なら通常)
  weight_b: number | null;      // super set partner weight
  reps_b: number | null;        // super set partner reps
};

export type Workout = {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_id_b: string | null;
  body_parts: BodyPart[];       // 配列化 (最大3 / 全身は単独)
  memo: string | null;
  performed_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  body_parts: BodyPart[] | null;
  created_at: string;
};

export type RoutineItem = {
  id: string;
  routine_id: string;
  position: number;
  exercise_id: string;
  exercise_id_b: string | null;
  target_sets: number;
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: "NORMAL SET",
  drop: "DROP SET",
  super: "SUPER SET",
  no_weight: "NO WEIGHT",
};

export const SET_TYPE_SHORT: Record<SetType, string> = {
  normal: "通常",
  drop: "ドロップ",
  super: "スーパー",
  no_weight: "自重",
};

export const SET_TYPE_HINTS: Record<SetType, string> = {
  normal: "通常のセットを記録します",
  drop: "段階的に重量を落として続行するセット（N段まで追加可能）",
  super: "種目A→種目Bを連続で行うセット",
  no_weight: "自重トレーニング。回数のみ記録します",
};

// 全身ボディパート判定（選んだら他は無効）
export function isFullBody(parts: BodyPart[]): boolean {
  return parts.includes("全身");
}
