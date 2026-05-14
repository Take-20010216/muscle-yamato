// すべての日時表示・週境界判定は Asia/Tokyo (JST = UTC+9) 基準で行う。
const TZ = "Asia/Tokyo";

function partsOf(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: get("year"), m: get("month"), d: get("day"),
    h: get("hour"), mi: get("minute"),
    wd: get("weekday"), // Mon, Tue, ...
  };
}

const WD_JP: Record<string, string> = {
  Sun: "日", Mon: "月", Tue: "火", Wed: "水", Thu: "木", Fri: "金", Sat: "土",
};

export function fmtDate(iso: string) {
  const p = partsOf(new Date(iso));
  return `${p.y}.${p.m}.${p.d}（${WD_JP[p.wd] ?? p.wd}）${p.h}:${p.mi}`;
}

export function fmtRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  return fmtDate(iso).slice(0, 10);
}

// JSTでの「今週の日曜0:00」を Date オブジェクトとして返す。
// 戻り値の .toISOString() で SupabaseのtimestamptzにそのままGTE比較できる。
export function startOfWeek(d = new Date()): Date {
  const p = partsOf(d);
  const wdIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.wd);
  // JST `y-m-day 00:00` = UTC (`y-m-day 00:00 - 9h`)
  const todayJstStartUtcMs = Date.UTC(Number(p.y), Number(p.m) - 1, Number(p.d)) - 9 * 3600 * 1000;
  return new Date(todayJstStartUtcMs - wdIdx * 86400 * 1000);
}

// 1セットのスコア = 重量 × 回数
export function setScore(weight: number, reps: number) {
  return weight * reps;
}

// performed_at(ISO/UTC) → "/sessions/[time]" 用スラッグ（分単位）
// 例: "2026-05-14T01:30:45.000Z" → "2026-05-14T01-30"
export function toSessionSlug(performedAt: string): string {
  return performedAt.slice(0, 16).replace(":", "-");
}
