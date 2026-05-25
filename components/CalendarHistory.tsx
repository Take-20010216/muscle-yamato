"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { jstDayRange, toJstDateKey, toSessionSlug } from "@/lib/utils";
import BodyPartIcon from "./BodyPartIcon";
import type { BodyPart, WorkoutSet } from "@/lib/types";

type WorkoutRow = {
  id: string;
  body_parts: BodyPart[];
  performed_at: string;
  exercise: { name: string; body_part: BodyPart } | null;
};

const WD_JP = ["日", "月", "火", "水", "木", "金", "土"];
// カレンダー表示は月曜始まり（Mo Tu We Th Fr Sa Su）
const WD_EN_MON_FIRST = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function jstNowParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  return { y, m, d };
}

function monthGrid(year: number, month1: number): { dateKey: string; inMonth: boolean }[] {
  // month1: 1-12 / 月曜始まり
  const first = new Date(Date.UTC(year, month1 - 1, 1));
  const firstWd = first.getUTCDay(); // 0=Sun..6=Sat
  // 月曜=0, ..., 日曜=6 にシフト
  const leading = (firstWd + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month1, 0)).getUTCDate();

  const cells: { dateKey: string; inMonth: boolean }[] = [];
  const prevMonth = month1 === 1 ? 12 : month1 - 1;
  const prevYear = month1 === 1 ? year - 1 : year;
  const prevDays = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  for (let i = leading - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ dateKey: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateKey: `${year}-${String(month1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
  }
  const nextMonth = month1 === 12 ? 1 : month1 + 1;
  const nextYear = month1 === 12 ? year + 1 : year;
  let nd = 1;
  while (cells.length < 42) {
    cells.push({ dateKey: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nd).padStart(2, "0")}`, inMonth: false });
    nd++;
  }
  return cells;
}

export default function CalendarHistory() {
  const today = useMemo(() => jstNowParts(), []);
  const [viewY, setViewY] = useState(today.y);
  const [viewM, setViewM] = useState(today.m);
  const [selectedKey, setSelectedKey] = useState<string>(
    `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`
  );

  // 月内のトレーニング日 (YYYY-MM-DD set)
  const [monthDays, setMonthDays] = useState<Set<string>>(new Set());
  const [loadingMonth, setLoadingMonth] = useState(true);

  // 選択日のワークアウト
  const [dayWorkouts, setDayWorkouts] = useState<WorkoutRow[]>([]);
  const [daySets, setDaySets] = useState<Record<string, WorkoutSet[]>>({});
  const [loadingDay, setLoadingDay] = useState(true);

  // 月変更時にトレーニング日を取得
  useEffect(() => {
    let cancelled = false;
    setLoadingMonth(true);
    const supabase = createClient();
    const firstKey = `${viewY}-${String(viewM).padStart(2, "0")}-01`;
    const { startIso: monthStart } = jstDayRange(firstKey);
    const nextM = viewM === 12 ? 1 : viewM + 1;
    const nextY = viewM === 12 ? viewY + 1 : viewY;
    const { startIso: monthEnd } = jstDayRange(`${nextY}-${String(nextM).padStart(2, "0")}-01`);

    supabase
      .from("workouts")
      .select("performed_at")
      .gte("performed_at", monthStart)
      .lt("performed_at", monthEnd)
      .then(({ data }) => {
        if (cancelled) return;
        const days = new Set<string>();
        for (const r of data ?? []) days.add(toJstDateKey(r.performed_at));
        setMonthDays(days);
        setLoadingMonth(false);
      });
    return () => { cancelled = true; };
  }, [viewY, viewM]);

  // 選択日変更時にワークアウト取得
  useEffect(() => {
    let cancelled = false;
    setLoadingDay(true);
    const supabase = createClient();
    const { startIso, endIso } = jstDayRange(selectedKey);

    (async () => {
      // 1往復目: workouts のみ取得（IDがないとsetsを取れない）
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id,body_parts,performed_at, exercise:exercises!workouts_exercise_id_fkey(name,body_part)")
        .gte("performed_at", startIso)
        .lt("performed_at", endIso)
        .order("performed_at", { ascending: true });
      if (cancelled) return;
      const rows = (workouts ?? []) as unknown as WorkoutRow[];
      setDayWorkouts(rows);
      if (rows.length === 0) {
        setDaySets({});
        setLoadingDay(false);
        return;
      }
      // setsだけ別フェッチ（IDが必要）
      const ids = rows.map((w) => w.id);
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("workout_id,set_index,set_type,weight,reps,drops,weight_b,reps_b,id")
        .in("workout_id", ids)
        .order("set_index");
      if (cancelled) return;
      const by: Record<string, WorkoutSet[]> = {};
      for (const s of (sets ?? []) as WorkoutSet[]) (by[s.workout_id] ||= []).push(s);
      setDaySets(by);
      setLoadingDay(false);
    })();
    return () => { cancelled = true; };
  }, [selectedKey]);

  const cells = useMemo(() => monthGrid(viewY, viewM), [viewY, viewM]);

  function prevMonth() {
    if (viewM === 1) { setViewY(viewY - 1); setViewM(12); }
    else setViewM(viewM - 1);
  }
  function nextMonth() {
    if (viewM === 12) { setViewY(viewY + 1); setViewM(1); }
    else setViewM(viewM + 1);
  }

  // セッションの body_parts を表示（ユーザーが開始時に選んだ部位）
  const sessionParts = useMemo(() => {
    const set = new Set<string>();
    for (const w of dayWorkouts) for (const p of w.body_parts ?? []) set.add(p);
    return Array.from(set);
  }, [dayWorkouts]);

  // 互換用 (DaySummaryCardはobjectからparts一覧と種目数を取る)
  const groupedByPart = useMemo(() => {
    const g: Record<string, { workout: WorkoutRow; sets: WorkoutSet[] }[]> = {};
    for (const p of sessionParts) g[p] = [];
    for (const w of dayWorkouts) {
      const key = sessionParts[0] ?? (w.exercise?.body_part ?? "その他");
      (g[key] ||= []).push({ workout: w, sets: daySets[w.id] ?? [] });
    }
    return g;
  }, [dayWorkouts, daySets, sessionParts]);

  const totalSets = Object.values(daySets).reduce((acc, arr) => acc + arr.length, 0);
  const selectedLabel = (() => {
    const [y, m, d] = selectedKey.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}（${WD_JP[wd]}）`;
  })();

  return (
    <>
      {/* カレンダー */}
      <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs tracking-widest text-ink font-bold">HISTORY</h3>
          <Link href="/stats" className="text-muted text-xs">すべて見る ›</Link>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-bold tracking-tight">{MONTH_EN[viewM - 1]} {viewY}</div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center text-muted">‹</button>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center text-muted">›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WD_EN_MON_FIRST.map((w) => (
            <div key={w} className="text-xs text-center py-1 text-muted">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            const hasWorkout = monthDays.has(c.dateKey);
            const isSelected = c.dateKey === selectedKey;
            const dayNum = Number(c.dateKey.slice(-2));
            return (
              <button
                key={i}
                onClick={() => setSelectedKey(c.dateKey)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl text-sm ${
                  !c.inMonth
                    ? "text-muted/40 bg-white border border-border/50"
                    : isSelected
                    ? "btn-metallic font-bold rounded-full"
                    : "text-ink bg-white border border-border shadow-sm"
                }`}
              >
                <span>{dayNum}</span>
                {hasWorkout && c.inMonth && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-navy" />
                )}
              </button>
            );
          })}
        </div>
        {loadingMonth && <p className="text-[10px] text-muted text-center mt-2">読み込み中...</p>}
      </div>

      {/* 選択日の記録カード（タップで詳細へ） */}
      <DaySummaryCard
        label={selectedLabel}
        loading={loadingDay}
        workouts={dayWorkouts}
        sessionParts={sessionParts}
        totalSets={totalSets}
      />
    </>
  );
}

function DaySummaryCard({
  label, loading, workouts, sessionParts, totalSets,
}: {
  label: string;
  loading: boolean;
  workouts: WorkoutRow[];
  sessionParts: string[];
  totalSets: number;
}) {
  const hasRecords = workouts.length > 0;
  const firstSlug = hasRecords ? toSessionSlug(workouts[0].performed_at) : null;
  const parts = sessionParts;

  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-ink">{label}のトレーニング記録</h3>
        {loading && <p className="text-muted text-xs mt-1">読み込み中...</p>}
        {!loading && !hasRecords && (
          <p className="text-muted text-xs mt-1">この日は記録がありません</p>
        )}
        {!loading && hasRecords && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {parts.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 text-[11px] bg-surface border border-border rounded-full px-2 py-0.5">
                <BodyPartIcon part={p} size={12} className="text-ink" />
                {p}
              </span>
            ))}
            <span className="text-[11px] text-muted">・種目{workouts.length}・{totalSets}セット</span>
          </div>
        )}
      </div>
      {hasRecords && <span className="text-muted shrink-0">›</span>}
    </div>
  );

  if (hasRecords && firstSlug) {
    return (
      <Link
        href={`/sessions/${firstSlug}`}
        prefetch={false}
        className="block bg-white border border-border rounded-xl p-4 shadow-sm mt-3 active:bg-surface"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-sm mt-3">
      {inner}
    </div>
  );
}
