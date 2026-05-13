import type { BodyPart } from "./types";

// 部位ごとのメイン4種目（初回ログイン時にDBへ自動投入）
export const DEFAULT_EXERCISES: { name: string; body_part: BodyPart }[] = [
  // 胸
  { name: "ベンチプレス", body_part: "胸" },
  { name: "インクラインベンチプレス", body_part: "胸" },
  { name: "ダンベルプレス", body_part: "胸" },
  { name: "ダンベルフライ", body_part: "胸" },
  // 背中
  { name: "デッドリフト", body_part: "背中" },
  { name: "懸垂", body_part: "背中" },
  { name: "ラットプルダウン", body_part: "背中" },
  { name: "ベントオーバーロウ", body_part: "背中" },
  // 脚
  { name: "スクワット", body_part: "脚" },
  { name: "レッグプレス", body_part: "脚" },
  { name: "レッグエクステンション", body_part: "脚" },
  { name: "レッグカール", body_part: "脚" },
  // 肩
  { name: "ショルダープレス", body_part: "肩" },
  { name: "サイドレイズ", body_part: "肩" },
  { name: "リアレイズ", body_part: "肩" },
  { name: "フロントレイズ", body_part: "肩" },
  // 腕
  { name: "バーベルカール", body_part: "腕" },
  { name: "ダンベルカール", body_part: "腕" },
  { name: "トライセプスエクステンション", body_part: "腕" },
  { name: "ナローベンチプレス", body_part: "腕" },
  // 体幹
  { name: "クランチ", body_part: "体幹" },
  { name: "プランク", body_part: "体幹" },
  { name: "レッグレイズ", body_part: "体幹" },
  { name: "ロシアンツイスト", body_part: "体幹" },
];
