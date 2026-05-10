import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtRelative, startOfWeek } from "@/lib/utils";
import type { BodyPart, SetType } from "@/lib/types";
import { BODY_PARTS } from "@/lib/types";

export const dynamic = "force-dynamic";

const SET_TYPE_BADGE: Record<SetType, string> = {
  normal: "NORMAL SET",
  drop: "DROP SET",
  super: "SUPER SET",
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id,set_type,body_part,performed_at,exercise_id, exercise:exercises!workouts_exercise_id_fkey(name)")
    .order("performed_at", { ascending: false })
    .limit(20);

  // counts of distinct exercises and total sets per workout
  const workoutIds = (workouts ?? []).map((w) => w.id);
  let setCounts: Record<string, number> = {};
  if (workoutIds.length) {
    const { data: sets } = await supabase
      .from("workout_sets")
      .select("workout_id")
      .in("workout_id", workoutIds);
    for (const s of sets ?? []) setCounts[s.workout_id] = (setCounts[s.workout_id] ?? 0) + 1;
  }

  // Group history by performed date
  const grouped: Record<string, { date: string; bodyParts: Set<BodyPart>; exerciseIds: Set<string>; setCount: number; setType: SetType }> = {};
  for (const w of workouts ?? []) {
    const key = w.performed_at.slice(0, 16);
    if (!grouped[key]) grouped[key] = { date: w.performed_at, bodyParts: new Set(), exerciseIds: new Set(), setCount: 0, setType: w.set_type };
    grouped[key].bodyParts.add(w.body_part as BodyPart);
    grouped[key].exerciseIds.add(w.exercise_id);
    grouped[key].setCount += setCounts[w.id] ?? 0;
  }
  const history = Object.values(grouped).slice(0, 4);

  // weekly volume per body part
  const weekStart = startOfWeek().toISOString();
  const { data: weekWorkouts } = await supabase
    .from("workouts")
    .select("id,body_part")
    .gte("performed_at", weekStart);
  const weekIds = (weekWorkouts ?? []).map((w) => w.id);
  let weekSetCount: Record<string, number> = {};
  if (weekIds.length) {
    const { data: ws } = await supabase
      .from("workout_sets")
      .select("workout_id")
      .in("workout_id", weekIds);
    for (const s of ws ?? []) weekSetCount[s.workout_id] = (weekSetCount[s.workout_id] ?? 0) + 1;
  }
  const weekVolume: Record<string, number> = {};
  for (const w of weekWorkouts ?? []) {
    weekVolume[w.body_part] = (weekVolume[w.body_part] ?? 0) + (weekSetCount[w.id] ?? 0);
  }

  // PB updates this week
  const { data: pbs } = await supabase
    .from("personal_bests")
    .select("weight,reps,achieved_at,exercise_id, exercise:exercises!personal_bests_exercise_id_fkey(name)")
    .gte("achieved_at", weekStart)
    .order("achieved_at", { ascending: false })
    .limit(3);

  // timeline preview
  const { data: posts } = await supabase
    .from("posts")
    .select("id,body,created_at,user_id, profile:profiles!posts_user_id_fkey(username,display_name,avatar_url)")
    .order("created_at", { ascending: false })
    .limit(2);

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider">MUSCLE YAMATO</h1>
          <p className="text-xs text-muted">筋トレ記録アプリ</p>
        </div>
        <Link href="/settings" className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
        </Link>
      </header>

      <Link
        href="/record"
        className="block bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-200 text-black rounded-2xl px-5 py-5 font-bold text-lg flex items-center justify-between shadow-lg"
      >
        <span className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-14h-7l0-6z"/></svg>
          Start workout
        </span>
        <span>→</span>
      </Link>

      <Section title="HISTORY" right={<Link href="/record" className="text-muted text-xs">すべて見る ›</Link>}>
        <div className="space-y-2">
          {history.length === 0 && <Empty text="まだ記録がありません。Start workoutから始めましょう。" />}
          {history.map((h, i) => (
            <div key={i} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{fmtDate(h.date)}</div>
                <div className="text-xs text-muted mt-0.5">
                  部位：{Array.from(h.bodyParts).join("/")} ｜ 種目数：{h.exerciseIds.size} ｜ セット数：{h.setCount}
                </div>
                <span className="inline-block mt-2 text-[10px] tracking-wider bg-bg border border-border rounded px-2 py-0.5">
                  {SET_TYPE_BADGE[h.setType]}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">1</div>
                <div className="text-[10px] text-muted">回</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="部位別ボリューム（今週）">
        <div className="grid grid-cols-5 gap-2">
          {BODY_PARTS.slice(0, 5).map((bp) => (
            <div key={bp} className="bg-card border border-border rounded-xl py-3 flex flex-col items-center">
              <BodyPartGlyph bp={bp} />
              <div className="text-xs mt-1">{bp}</div>
              <div className="text-[10px] text-muted">{weekVolume[bp] ?? 0}セット</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="自己ベスト更新">
        {(!pbs || pbs.length === 0) ? <Empty text="今週の自己ベスト更新はまだありません" /> : (
          <div className="space-y-2">
            {pbs.map((p: any, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👑</span>
                  <div>
                    <div className="font-semibold">{p.exercise?.name ?? "種目"}</div>
                    <div className="text-xs text-muted">自己ベスト更新！</div>
                    <div className="text-sm">{p.weight}kg × {p.reps}回</div>
                  </div>
                </div>
                <div className="text-[10px] text-muted">NEW RECORD ›</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="タイムライン" right={<Link href="/timeline" className="text-muted text-xs">すべて見る ›</Link>}>
        {(!posts || posts.length === 0) ? <Empty text="投稿がありません" /> : (
          <div className="space-y-2">
            {posts.map((p: any) => (
              <Link key={p.id} href="/timeline" className="block bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-bg border border-border" />
                  <div>
                    <div className="text-sm font-semibold">{p.profile?.display_name ?? p.profile?.username ?? "ユーザー"}</div>
                    <div className="text-[10px] text-muted">{fmtRelative(p.created_at)}</div>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{p.body}</p>
              </Link>
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
  return <p className="text-muted text-xs bg-card border border-border rounded-xl px-4 py-3">{text}</p>;
}

function BodyPartGlyph({ bp }: { bp: BodyPart }) {
  const map: Record<BodyPart, string> = { 胸: "🫁", 背中: "🦴", 脚: "🦵", 肩: "🤷", 腕: "💪", 体幹: "🧘", その他: "✨" };
  return <span className="text-xl">{map[bp]}</span>;
}
