import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { startOfWeek } from "@/lib/utils";
import { BODY_PARTS } from "@/lib/types";
import CalendarHistory from "@/components/CalendarHistory";
import BodyPartIcon from "@/components/BodyPartIcon";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-wider">MUSCLE YAMATO</h1>
            <p className="text-xs text-muted">筋トレ記録アプリ</p>
          </div>
          {/* 力こぶアイコン */}
          <svg width="42" height="42" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 30c2-6 6-9 12-9 4 0 5 2 7 5" />
            <path d="M14 21c2-3 2-7 0-10" />
            <path d="M19 26c3-2 6-2 9 1 3 3 5 8 3 13" />
            <path d="M28 27c3 0 6 1 8 3 2 2 3 5 2 8" />
            <path d="M35 24c2-2 4-2 6 0" />
            <path d="M6 30c-1 2-1 4 1 5 4 2 9 1 12-1" />
          </svg>
        </div>
        <Link href="/settings" className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center shrink-0">
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

      <div className="mt-4">
        <CalendarHistory />
      </div>

      <Section title="部位別ボリューム（今週）">
        <Suspense fallback={<SkeletonGrid />}>
          <WeeklyVolumeSection />
        </Suspense>
      </Section>

      <Section title="自己ベスト更新（今週）">
        <Suspense fallback={<SkeletonList />}>
          <PBSection />
        </Suspense>
      </Section>
    </main>
  );
}

async function WeeklyVolumeSection() {
  const supabase = await createClient();
  const weekStart = startOfWeek().toISOString();
  const { data: weekW } = await supabase
    .from("workouts")
    .select("id,body_parts")
    .gte("performed_at", weekStart);

  const week = (weekW ?? []) as { id: string; body_parts: string[] }[];
  let counts: Record<string, number> = {};
  if (week.length) {
    const { data: sets } = await supabase
      .from("workout_sets")
      .select("workout_id")
      .in("workout_id", week.map((w) => w.id));
    for (const s of sets ?? []) counts[s.workout_id] = (counts[s.workout_id] ?? 0) + 1;
  }
  // body_parts は配列なので、各部位に同じセット数を加算
  const vol: Record<string, number> = {};
  for (const w of week) {
    const c = counts[w.id] ?? 0;
    for (const p of w.body_parts ?? []) vol[p] = (vol[p] ?? 0) + c;
  }

  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
      {BODY_PARTS.map((bp) => (
        <div key={bp} className="bg-white border border-border rounded-xl py-3 px-2 flex flex-col items-center shrink-0 min-w-[68px]">
          <BodyPartIcon part={bp} size={22} className="text-red-500 mb-1" />
          <span className="text-[10px] font-medium whitespace-nowrap">{bp}</span>
          <div className="text-base font-bold mt-1">{vol[bp] ?? 0}</div>
          <div className="text-[10px] text-muted">セット</div>
        </div>
      ))}
    </div>
  );
}

async function PBSection() {
  const supabase = await createClient();
  const weekStart = startOfWeek().toISOString();
  const { data: pbs } = await supabase
    .from("personal_bests")
    .select("weight,reps,achieved_at,exercise_id, exercise:exercises!personal_bests_exercise_id_fkey(name)")
    .gte("achieved_at", weekStart)
    .order("achieved_at", { ascending: false })
    .limit(3);

  if (!pbs || pbs.length === 0) return <Empty text="今週の自己ベスト更新はまだありません" />;

  return (
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

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-xl px-4 py-3 h-16 animate-pulse" />
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-xl h-16 animate-pulse" />
      ))}
    </div>
  );
}
