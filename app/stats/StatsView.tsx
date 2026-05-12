"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, startOfWeek } from "@/lib/utils";
import type { BodyPart, SetType, WorkoutSet } from "@/lib/types";
import { BODY_PARTS, SET_TYPE_LABELS } from "@/lib/types";

type WorkoutRow = {
  id: string;
  set_type: SetType;
  body_part: BodyPart;
  performed_at: string;
  memo: string | null;
  exercise: { name: string } | null;
  exercise_b: { name: string } | null;
  sets: WorkoutSet[];
};

export default function StatsView() {
  const [tab, setTab] = useState<"weekly" | "history" | "pb">("weekly");
  const [weekVolume, setWeekVolume] = useState<Record<string, number>>({});
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [pbs, setPbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const supabase = createClient();
    const weekStart = startOfWeek().toISOString();

    const [weekWRes, wsRes, pbRes] = await Promise.all([
      supabase.from("workouts").select("id,body_part").gte("performed_at", weekStart),
      supabase
        .from("workouts")
        .select("id,set_type,body_part,performed_at,memo, exercise:exercises!workouts_exercise_id_fkey(name), exercise_b:exercises!workouts_exercise_id_b_fkey(name)")
        .order("performed_at", { ascending: false })
        .limit(50),
      supabase
        .from("personal_bests")
        .select("weight,reps,achieved_at,exercise_id, exercise:exercises!personal_bests_exercise_id_fkey(name,body_part)")
        .order("achieved_at", { ascending: false }),
    ]);

    const weekW = weekWRes.data ?? [];
    const ids = weekW.map((w) => w.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: ws } = await supabase.from("workout_sets").select("workout_id").in("workout_id", ids);
      for (const s of ws ?? []) counts[s.workout_id] = (counts[s.workout_id] ?? 0) + 1;
    }
    const vol: Record<string, number> = {};
    for (const w of weekW) vol[w.body_part] = (vol[w.body_part] ?? 0) + (counts[w.id] ?? 0);
    setWeekVolume(vol);

    const ws = wsRes.data ?? [];
    if (ws.length) {
      const wIds = ws.map((w: any) => w.id);
      const { data: sets } = await supabase.from("workout_sets").select("*").in("workout_id", wIds).order("set_index");
      const byW: Record<string, WorkoutSet[]> = {};
      for (const s of (sets ?? []) as WorkoutSet[]) (byW[s.workout_id] ||= []).push(s);
      setWorkouts(ws.map((w: any) => ({ ...w, sets: byW[w.id] ?? [] })) as WorkoutRow[]);
    } else { setWorkouts([]); }

    const pb = pbRes.data ?? [];
    const seen = new Set<string>();
    setPbs(pb.filter((p: any) => { if (seen.has(p.exercise_id)) return false; seen.add(p.exercise_id); return true; }));

    setLoading(false);
  }

  async function deleteWorkout(id: string) {
    if (!confirm("この記録を削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("workouts").delete().eq("id", id);
    loadAll();
  }

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">統計</h1>
        <span className="w-6" />
      </header>

      <div className="grid grid-cols-3 bg-surface border border-border rounded-xl p-1 mb-5">
        <TabBtn active={tab === "weekly"} onClick={() => setTab("weekly")}>今週</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>履歴</TabBtn>
        <TabBtn active={tab === "pb"} onClick={() => setTab("pb")}>自己ベスト</TabBtn>
      </div>

      {loading && <p className="text-muted text-sm">読み込み中...</p>}

      {!loading && tab === "weekly" && (
        <div>
          <h3 className="text-sm tracking-widest text-muted mb-2">部位別ボリューム</h3>
          <div className="grid grid-cols-2 gap-2">
            {BODY_PARTS.map((bp) => (
              <div key={bp} className="bg-white border border-border rounded-xl p-3 flex items-center justify-between">
                <span className="font-medium">{bp}</span>
                <span className="text-xl font-bold">{weekVolume[bp] ?? 0}<span className="text-xs text-muted ml-1">セット</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === "history" && (
        <div className="space-y-2">
          {workouts.length === 0 && <p className="text-muted text-sm">記録がありません</p>}
          {workouts.map((w) => (
            <div key={w.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted">{fmtDate(w.performed_at)}</div>
                  <div className="font-bold mt-0.5">{w.exercise?.name ?? "?"}{w.exercise_b ? ` ＋ ${w.exercise_b.name}` : ""}</div>
                  <span className="inline-block mt-1 text-[10px] tracking-wider bg-surface border border-border rounded px-2 py-0.5">{SET_TYPE_LABELS[w.set_type]}</span>
                </div>
                <button onClick={() => deleteWorkout(w.id)} className="text-red-500 text-sm">削除</button>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {w.sets.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-muted w-6">{s.set_index}</span>
                    <span>{s.weight}kg × {s.reps}回</span>
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
          ))}
        </div>
      )}

      {!loading && tab === "pb" && (
        <div className="space-y-2">
          {pbs.length === 0 && <p className="text-muted text-sm">自己ベストはまだありません</p>}
          {pbs.map((p, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-bold">{p.exercise?.name ?? "?"}</div>
                <div className="text-xs text-muted">{p.exercise?.body_part}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{p.weight}kg × {p.reps}回</div>
                <div className="text-[10px] text-muted">{p.achieved_at.slice(0, 10).replace(/-/g, ".")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`py-2 text-xs rounded-lg ${active ? "bg-white shadow-sm font-bold text-ink" : "text-muted"}`}>{children}</button>;
}
