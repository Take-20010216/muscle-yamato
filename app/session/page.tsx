"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/utils";
import type { BodyPart, SetType, WorkoutSet, DropStage } from "@/lib/types";
import { SET_TYPE_LABELS } from "@/lib/types";
import BodyPartIcon from "@/components/BodyPartIcon";

type WorkoutRow = {
  id: string;
  body_parts: BodyPart[];
  performed_at: string;
  memo: string | null;
  exercise: { name: string; body_part: BodyPart } | null;
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

export default function SessionDetailPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-6"><p className="text-muted text-sm">読み込み中...</p></main>}>
      <SessionDetailInner />
    </Suspense>
  );
}

function SessionDetailInner() {
  const params = useSearchParams();
  const time = params.get("t") ?? "";
  const [rows, setRows] = useState<WorkoutRow[] | null>(null);
  const [byW, setByW] = useState<Record<string, WorkoutSet[]>>({});

  useEffect(() => {
    let cancelled = false;
    const range = parseMinuteSlug(time);
    if (!range) { setRows([]); return; }
    (async () => {
      const supabase = createClient();
      const { data: workouts } = await supabase
        .from("workouts")
        .select(
          "id,body_parts,performed_at,memo, exercise:exercises!workouts_exercise_id_fkey(name,body_part), exercise_b:exercises!workouts_exercise_id_b_fkey(name)"
        )
        .gte("performed_at", range.start)
        .lt("performed_at", range.end)
        .order("performed_at", { ascending: true });
      if (cancelled) return;
      const r = (workouts ?? []) as unknown as WorkoutRow[];
      setRows(r);
      if (r.length === 0) return;

      const ids = r.map((w) => w.id);
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("*")
        .in("workout_id", ids)
        .order("set_index");
      if (cancelled) return;
      const map: Record<string, WorkoutSet[]> = {};
      for (const s of (sets ?? []) as WorkoutSet[]) (map[s.workout_id] ||= []).push(s);
      setByW(map);
    })();
    return () => { cancelled = true; };
  }, [time]);

  if (rows === null) {
    return <main className="px-4 pt-6"><p className="text-muted text-sm">読み込み中...</p></main>;
  }
  if (rows.length === 0) {
    return (
      <main className="px-4 pt-6">
        <header className="flex items-center justify-between mb-4">
          <Link href="/" className="text-2xl">‹</Link>
          <h1 className="font-bold">記録の詳細</h1>
          <span className="w-6" />
        </header>
        <p className="text-muted text-sm bg-white border border-border rounded-xl px-4 py-3">記録が見つかりませんでした。</p>
      </main>
    );
  }

  const headDate = rows[0].performed_at;
  const sessionParts = Array.from(new Set(rows.flatMap((r) => r.body_parts ?? [])));

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">記録の詳細</h1>
        <span className="w-6" />
      </header>

      <div className="bg-white border border-border rounded-xl px-4 py-3 mb-4 shadow-sm">
        <div className="text-xs text-muted">{fmtDate(headDate)}</div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {sessionParts.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 text-[11px] bg-surface border border-border rounded-full px-2 py-0.5">
              <BodyPartIcon part={p} size={14} className="text-ink" />
              {p}
            </span>
          ))}
          <span className="text-xs text-muted ml-auto self-center">種目：{rows.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((w) => {
          const ws = byW[w.id] ?? [];
          const wParts = w.body_parts ?? [];
          return (
            <div key={w.id} className="bg-white border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">
                    {w.exercise?.name ?? "?"}
                    {w.exercise_b ? ` ＋ ${w.exercise_b.name}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                  {wParts.map((p) => (
                    <span key={p} className="inline-flex items-center gap-0.5 text-[11px] text-muted">
                      <BodyPartIcon part={p} size={14} className="text-ink" />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {ws.map((s) => {
                  const drops = (s.drops ?? []) as DropStage[];
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-muted w-6">{s.set_index}</span>
                      <span>
                        {s.set_type === "no_weight" ? `${s.reps}回（自重）` : `${s.weight}kg × ${s.reps}回`}
                      </span>
                      <span className="text-[9px] tracking-wider text-muted">{SET_TYPE_LABELS[s.set_type as SetType]}</span>
                      {s.has_assist && (
                        <span className="text-[10px] bg-yellow-400 text-yellow-900 border border-yellow-500 rounded px-1.5 py-0.5 font-bold">🤝 補助</span>
                      )}
                      {s.set_type === "drop" && drops.length > 0 && (
                        <span className="text-muted text-xs">
                          {drops.map((d) => ` → ${d.weight}kg × ${d.reps}回`).join("")}
                        </span>
                      )}
                      {s.set_type === "super" && s.weight_b != null && (
                        <span className="text-muted text-xs">＋ {s.weight_b}kg × {s.reps_b}回</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {w.memo && <p className="mt-2 text-xs text-muted whitespace-pre-wrap">📝 {w.memo}</p>}
            </div>
          );
        })}
      </div>
    </main>
  );
}
