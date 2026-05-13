import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, startOfWeek } from "@/lib/utils";
import type { BodyPart, SetType } from "@/lib/types";
import { BODY_PARTS } from "@/lib/types";

export const dynamic = "force-dynamic";

const SET_TYPE_BADGE: Record<SetType, string> = {
  normal: "NORMAL SET",
  drop: "DROP SET",
  super: "SUPER SET",
  no_weight: "NO WEIGHT",
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const weekStart = startOfWeek().toISOString();

  // Parallelize all top-level queries
  const [workoutsRes, weekWRes, pbsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select("id,set_type,body_part,performed_at,exercise_id, exercise:exercises!workouts_exercise_id_fkey(name)")
      .order("performed_at", { ascending: false })
      .limit(20),
    supabase
      .from("workouts")
      .select("id,body_part")
      .gte("performed_at", weekStart),
    supabase
      .from("personal_bests")
      .select("weight,reps,achieved_at,exercise_id, exercise:exercises!personal_bests_exercise_id_fkey(name)")
      .gte("achieved_at", weekStart)
      .order("achieved_at", { ascending: false })
      .limit(3),
  ]);

  const workouts = workoutsRes.data ?? [];
  const weekWorkouts = weekWRes.data ?? [];
  const pbs = pbsRes.data ?? [];

  // Fetch set counts in one query (combining ids from both)
  const allIds = Array.from(new Set([...workouts.map((w) => w.id), ...weekWorkouts.map((w) => w.id)]));
  let setCounts: Record<string, number> = {};
  if (allIds.length) {
    const { data: sets } = await supabase
      .from("workout_sets")
      .select("workout_id")
      .in("workout_id", allIds);
    for (const s of sets ?? []) setCounts[s.workout_id] = (setCounts[s.workout_id] ?? 0) + 1;
  }

  // Group history by performed minute
  const grouped: Record<string, { date: string; bodyParts: Set<BodyPart>; exerciseIds: Set<string>; setCount: number; setType: SetType }> = {};
  for (const w of workouts) {
    const key = w.performed_at.slice(0, 16);
    if (!grouped[key]) grouped[key] = { date: w.performed_at, bodyParts: new Set(), exerciseIds: new Set(), setCount: 0, setType: w.set_type };
    grouped[key].bodyParts.add(w.body_part as BodyPart);
    grouped[key].exerciseIds.add(w.exercise_id);
    grouped[key].setCount += setCounts[w.id] ?? 0;
  }
  const history = Object.values(grouped).slice(0, 4);

  // Weekly volume
  const weekVolume: Record<string, number> = {};
  for (const w of weekWorkouts) {
    weekVolume[w.body_part] = (weekVolume[w.body_part] ?? 0) + (setCounts[w.id] ?? 0);
  }

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider">MUSCLE YAMATO</h1>
          <p className="text-xs text-muted">筋トレ記録アプリ</p>
        </div>
        <Link href="/settings" className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
        </Link>
      </header>

      <Link
        href="/record"
        prefetch={true}
        className="btn-metallic rounded-2xl px-5 py-5 text-lg flex items-center justify-between"
      >
        <span className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-14h-7l0-6z"/></svg>
          Start workout
        </span>
        <span>→</span>
      </Link>

      <Section title="HISTORY" right={<Link href="/stats" className="text-muted text-xs">すべて見る ›</Link>}>
        <div className="space-y-2">
          {history.length === 0 && <Empty text="まだ記録がありません。Start workoutから始めましょう。" />}
          {history.map((h, i) => (
            <div key={i} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
              <div>
                <div className="font-semibold text-sm">{fmtDate(h.date)}</div>
                <div className="text-xs text-muted mt-0.5">
                  部位：{Array.from(h.bodyParts).join("/")} ｜ 種目：{h.exerciseIds.size} ｜ セット：{h.setCount}
                </div>
                <span className="inline-block mt-2 text-[10px] tracking-wider bg-surface border border-border rounded px-2 py-0.5">
                  {SET_TYPE_BADGE[h.setType]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="部位別ボリューム（今週）">
        <div className="grid grid-cols-5 gap-2">
          {BODY_PARTS.slice(0, 5).map((bp) => (
            <div key={bp} className="bg-white border border-border rounded-xl py-3 flex flex-col items-center">
              <span className="text-xs font-medium">{bp}</span>
              <div className="text-base font-bold mt-1">{weekVolume[bp] ?? 0}</div>
              <div className="text-[10px] text-muted">セット</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="自己ベスト更新（今週）">
        {(!pbs || pbs.length === 0) ? <Empty text="今週の自己ベスト更新はまだありません" /> : (
          <div className="space-y-2">
            {pbs.map((p: any, i) => (
              <div key={i} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <div className="font-semibold">{p.exercise?.name ?? "種目"}</div>
                    <div className="text-xs text-muted">自己ベスト更新！</div>
                    <div className="text-sm font-bold">{p.weight}kg × {p.reps}回</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm tracking-widest text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-muted text-xs bg-white border border-border rounded-xl px-4 py-3">{text}</p>;
}
