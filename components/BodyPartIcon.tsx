// 部位アイコン。フェーズ1では既存DBのbody_part(胸/背中/脚/肩/腕/体幹/その他)＋
// 将来追加予定(上腕二頭筋/上腕三頭筋/全身)に対応。
// シンプルなline-artスタイルでmasculine/serious感を出す。

type Props = { part: string; size?: number; className?: string };

export default function BodyPartIcon({ part, size = 24, className = "" }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (part) {
    case "胸":
      return (
        <svg {...common} aria-label="胸">
          <path d="M3 8c2-2 4-3 9-3s7 1 9 3c0 4-2 8-5 8-2 0-3-1-4-3-1 2-2 3-4 3-3 0-5-4-5-8z" />
          <path d="M12 5v8" />
        </svg>
      );
    case "背中":
      return (
        <svg {...common} aria-label="背中">
          <path d="M6 4l6 3 6-3" />
          <path d="M12 7v14" />
          <path d="M6 10c0 5 2 9 6 11 4-2 6-6 6-11" />
          <path d="M9 12l-2 3" />
          <path d="M15 12l2 3" />
        </svg>
      );
    case "肩":
      return (
        <svg {...common} aria-label="肩">
          <circle cx="6" cy="10" r="3.5" />
          <circle cx="18" cy="10" r="3.5" />
          <path d="M9 12c1 2 5 2 6 0" />
        </svg>
      );
    case "腕":
    case "上腕二頭筋":
      return (
        <svg {...common} aria-label={part}>
          <path d="M4 18c2-1 4-2 5-5 1-3 3-5 6-6" />
          <path d="M9 13c2-1 4 0 5 2" />
          <path d="M15 7l3-2" />
          <path d="M20 5l2-1" />
        </svg>
      );
    case "上腕三頭筋":
      return (
        <svg {...common} aria-label="上腕三頭筋">
          <path d="M5 6c1 2 2 4 4 6 2 2 4 4 6 6" />
          <path d="M8 8c2 1 3 3 4 5" />
          <path d="M14 5l3 1" />
        </svg>
      );
    case "脚":
      return (
        <svg {...common} aria-label="脚">
          <path d="M9 3c-1 4-1 8 0 12 1 3 1 5 0 6" />
          <path d="M15 3c1 4 1 8 0 12-1 3-1 5 0 6" />
          <path d="M7 21h4" />
          <path d="M13 21h4" />
        </svg>
      );
    case "体幹":
      return (
        <svg {...common} aria-label="体幹">
          <rect x="7" y="4" width="10" height="16" rx="2" />
          <path d="M7 9h10" />
          <path d="M7 14h10" />
          <path d="M12 4v16" />
        </svg>
      );
    case "全身":
      return (
        <svg {...common} aria-label="全身">
          <circle cx="12" cy="4" r="2" />
          <path d="M12 6v8" />
          <path d="M8 8l8 0" />
          <path d="M12 14l-3 7" />
          <path d="M12 14l3 7" />
        </svg>
      );
    case "その他":
    default:
      return (
        <svg {...common} aria-label="その他">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
  }
}
