"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, startOfWeek, toSessionSlug } from "@/lib/utils";
import type { BodyPart, SetType, WorkoutSet, DropStage } from "@/lib/types";
import { BODY_PARTS, SET_TYPE_LABELS } from "@/lib/types";
import BodyPartIcon from "@/components/BodyPartIcon";

type WorkoutRow = {
  id: string;
  body_parts: BodyPart[];
  performed_at: string;
  memo: string | null;
  exercise: { name: string; body_part: BodyPart } | null;
  exercise_b: { name: string } | null;
  sets: WorkoutSet[];
};

export default function StatsView() {
  const [tab, setTab] = useState<"weekly" | "history" | "pb">("weekly");
  const [weekVolume, setWeekVolume] = useState<Record<string, number>>({});
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [pbs, setPbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const supabase = createClient();
    const weekStart = startOfWeek().toISOString();

    const [weekWRes, wsRes, pbRes] = await Promise.all([
      supabase.from("workouts").select("id,body_parts").gte("performed_at", weekStart),
      supabase
        .from("workouts")
        .select("id,body_parts,performed_at,memo, exercise:exercises!workouts_exercise_id_fkey(name,body_part), exercise_b:exercises!workouts_exercise_id_b_fkey(name)")
        .order("performed_at", { ascending: false })
        .limit(50),
      supabase
        .from("personal_bests")
        .select("weight,reps,set_type,achieved_at,exercise_id, exercise:exercises!personal_bests_exercise_id_fkey(name,body_part)")
        .order("achieved_at", { ascending: false }),
    ]);

    const weekW = (weekWRes.data ?? []) as { id: string; body_parts: string[] }[];
    const ids = weekW.map((w) => w.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: ws } = await supabase.from("workout_sets").select("workout_id").in("workout_id", ids);
      for (const s of ws ?? []) counts[s.workout_id] = (counts[s.workout_id] ?? 0) + 1;
    }
    const vol: Record<string, number> = {};
    for (const w of weekW) {
      const c = counts[w.id] ?? 0;
      for (const p of w.body_parts ?? []) vol[p] = (vol[p] ?? 0) + c;
    }
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
                <div className="flex items-center gap-2">
                  <BodyPartIcon part={bp} size={20} className="text-ink" />
                  <span className="font-medium">{bp}</span>
                </div>
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
            <div
              key={w.id}
              onClick={() => router.push(`/sessions/${toSessionSlug(w.performed_at)}`)}
              className="bg-white border border-border rounded-xl p-4 cursor-pointer active:bg-surface"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted">{fmtDate(w.performed_at)}</div>
                  <div className="font-bold mt-0.5">{w.exercise?.name ?? "?"}{w.exercise_b ? ` ＋ ${w.exercise_b.name}` : ""}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(w.body_parts ?? []).map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 text-[10px] bg-surface border border-border rounded-full px-1.5 py-0.5">
                        <BodyPartIcon part={p} size={12} className="text-ink" />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteWorkout(w.id); }}
                  className="text-red-500 text-sm"
                >削除</button>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {w.sets.map((s) => {
                  const drops = (s.drops ?? []) as DropStage[];
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-2">
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
                <div className="text-xs text-muted flex items-center gap-1">
                  {p.exercise?.body_part && <BodyPartIcon part={p.exercise.body_part} size={12} className="text-ink" />}
                  {p.exercise?.body_part}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">
                  {p.set_type === "no_weight" ? `${p.reps}回` : `${p.weight}kg × ${p.reps}回`}
                </div>
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
