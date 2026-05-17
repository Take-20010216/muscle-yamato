import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/utils";
import type { BodyPart, SetType, WorkoutSet } from "@/lib/types";
import { SET_TYPE_LABELS } from "@/lib/types";

type WorkoutRow = {
  id: string;
  set_type: SetType;
  body_part: BodyPart;
  performed_at: string;
  memo: string | null;
  exercise: { name: string } | null;
  exercise_b: { name: string } | null;
};

function parseMinuteSlug(slug: string): { start: string; end: string } | null {
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})$/);
  if (!m) return null;
  const start = new Date(`${m[1]}T${m[2]}:${m[3]}:00.000Z`);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function SessionDetailPage({ params }: { params: Promise<{ time: string }> }) {
  const { time } = await params;
  const range = parseMinuteSlug(time);
  if (!range) notFound();

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: workouts } = await supabase
    .from("workouts")
    .select(
      "id,set_type,body_part,performed_at,memo, exercise:exercises!workouts_exercise_id_fkey(name), exercise_b:exercises!workouts_exercise_id_b_fkey(name)"
    )
    .gte("performed_at", range.start)
    .lt("performed_at", range.end)
    .order("performed_at", { ascending: true });

  const rows = (workouts ?? []) as unknown as WorkoutRow[];
  if (rows.length === 0) notFound();

  const ids = rows.map((w) => w.id);
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("*")
    .in("workout_id", ids)
    .order("set_index");
  const byW: Record<string, WorkoutSet[]> = {};
  for (const s of (sets ?? []) as WorkoutSet[]) (byW[s.workout_id] ||= []).push(s);

  const headDate = rows[0].performed_at;
  const bodyParts = Array.from(new Set(rows.map((r) => r.body_part)));

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">記録の詳細</h1>
        <span className="w-6" />
      </header>

      <div className="bg-white border border-border rounded-xl px-4 py-3 mb-4 shadow-sm">
        <div className="text-xs text-muted">{fmtDate(headDate)}</div>
        <div className="text-xs text-muted mt-0.5">部位：{bodyParts.join("/")} ｜ 種目：{rows.length}</div>
      </div>

      <div className="space-y-3">
        {rows.map((w) => {
          const ws = byW[w.id] ?? [];
          return (
            <div key={w.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">
                    {w.exercise?.name ?? "?"}
                    {w.exercise_b ? ` ＋ ${w.exercise_b.name}` : ""}
                  </div>
                  <span className="inline-block mt-1 text-[10px] tracking-wider bg-surface border border-border rounded px-2 py-0.5">
                    {SET_TYPE_LABELS[w.set_type]}
                  </span>
                </div>
                <span className="text-xs text-muted">{w.body_part}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {ws.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-muted w-6">{s.set_index}</span>
                    <span>
                      {w.set_type === "no_weight" ? `${s.reps}回（自重）` : `${s.weight}kg × ${s.reps}回`}
                    </span>
                    {w.set_type === "drop" && s.drop_weight != null && (
                      <span className="text-muted text-xs">→ {s.drop_weight}kg × {s.drop_reps}回</span>
                    )}
                    {w.set_type === "super" && s.weight_b != null && (
                      <span className="text-muted text-xs">＋ {s.weight_b}kg × {s.reps_b}回</span>
                    )}
                  </li>
                ))}
              </ul>
              {w.memo && <p className="mt-2 text-xs text-muted whitespace-pre-wrap">📝 {w.memo}</p>}
            </div>
          );
        })}
      </div>
    </main>
  );
}
