// 力こぶ（フレックスアーム）アイコン。塗りつぶし黒シルエット。
type Props = { className?: string; size?: number };
export default function FlexArmIcon({ className = "", size }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-label="flex arm"
    >
      {/* 拳（指の輪郭） */}
      <path d="M50 4c5 0 9 4 9 9v8c0 4-3 7-7 7h-1c-3 0-5-2-6-4l-1-3v-9c0-4 3-8 6-8z" />
      {/* 拳の関節ライン */}
      <path d="M52 12h6v2h-6zM52 17h6v2h-6zM52 22h6v2h-6z" fill="rgba(255,255,255,0.18)" />
      {/* 前腕（拳から肘へ） */}
      <path d="M44 12c2 0 4 1 5 3l1 3v9c-1 4-4 6-8 6l-9-1c-4-1-7-3-9-6-1-2-1-4 0-6 2-3 5-5 9-6l11-2z" />
      {/* 上腕：力こぶ（大きく盛り上がった部分） */}
      <path d="M19 18c5-1 11 0 15 3 5 4 6 10 4 16-1 4-4 7-8 8H22c-5 0-9-4-10-9-1-7 1-13 7-18z" />
      {/* 肩〜上腕の下側 */}
      <path d="M12 35c1 5 4 9 8 11 2 1 3 3 3 5l-1 8c0 2-2 3-4 3H8c-2 0-4-2-4-4V42c0-3 1-5 3-7l5-0z" />
      {/* 肩のライン強調 */}
      <path d="M9 38c2-1 4-1 6 0v3c-2-1-4-1-6 0z" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}
