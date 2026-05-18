"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { jstDayRange, toJstDateKey } from "@/lib/utils";
import BodyPartIcon from "./BodyPartIcon";
import type { BodyPart, SetType, WorkoutSet } from "@/lib/types";

type WorkoutRow = {
  id: string;
  set_type: SetType;
  body_part: BodyPart;
  performed_at: string;
  exercise: { name: string } | null;
};

const WD_JP = ["日", "月", "火", "水", "木", "金", "土"];

function jstNowParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  return { y, m, d };
}

function monthGrid(year: number, month1: number): { dateKey: string; inMonth: boolean }[] {
  // month1: 1-12
  const first = new Date(Date.UTC(year, month1 - 1, 1));
  const firstWd = first.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month1, 0)).getUTCDate();

  const cells: { dateKey: string; inMonth: boolean }[] = [];
  // 前月分
  const prevMonth = month1 === 1 ? 12 : month1 - 1;
  const prevYear = month1 === 1 ? year - 1 : year;
  const prevDays = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  for (let i = firstWd - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ dateKey: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
  }
  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateKey: `${year}-${String(month1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
  }
  // 翌月分（6行 = 42セルになるよう）
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
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id,set_type,body_part,performed_at, exercise:exercises!workouts_exercise_id_fkey(name)")
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
      const ids = rows.map((w) => w.id);
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("*")
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

  // 部位ごとにグループ化
  const groupedByPart = useMemo(() => {
    const g: Record<string, { workout: WorkoutRow; sets: WorkoutSet[] }[]> = {};
    for (const w of dayWorkouts) {
      (g[w.body_part] ||= []).push({ workout: w, sets: daySets[w.id] ?? [] });
    }
    return g;
  }, [dayWorkouts, daySets]);

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
          <h3 className="text-xs tracking-widest text-red-500 font-bold">HISTORY</h3>
          <Link href="/stats" className="text-muted text-xs">すべて見る ›</Link>
        </div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center text-muted">‹</button>
          <div className="font-bold text-sm">{viewY}年{viewM}月</div>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center text-muted">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WD_JP.map((w, i) => (
            <div key={w} className={`text-[10px] text-center py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted"}`}>{w}</div>
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
                className={`relative aspect-square flex flex-col items-center justify-center rounded-full text-sm ${
                  !c.inMonth ? "text-muted/40" : isSelected ? "bg-red-500 text-white font-bold" : "text-ink"
                }`}
              >
                <span>{dayNum}</span>
                {hasWorkout && c.inMonth && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>
        {loadingMonth && <p className="text-[10px] text-muted text-center mt-2">読み込み中...</p>}
      </div>

      {/* 選択日の記録 */}
      <div className="bg-white border border-border rounded-xl p-4 shadow-sm mt-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-red-500">{selectedLabel}のトレーニング記録</h3>
        </div>

        {loadingDay && <p className="text-muted text-xs">読み込み中...</p>}
        {!loadingDay && dayWorkouts.length === 0 && (
          <p className="text-muted text-xs">この日は記録がありません</p>
        )}

        {!loadingDay && Object.entries(groupedByPart).map(([part, items]) => (
          <div key={part} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <BodyPartIcon part={part} size={28} className="text-red-500" />
              <span className="font-bold">{part}</span>
            </div>
            <div className="grid grid-cols-[1fr_60px_72px_60px] gap-x-2 text-[11px] text-muted mb-1 px-1">
              <span>種目</span>
              <span className="text-right">セット</span>
              <span className="text-right">重量</span>
              <span className="text-right">回数</span>
            </div>
            {items.map(({ workout: w, sets }) => {
              const setCount = sets.length;
              const topSet = sets.reduce<WorkoutSet | null>((best, s) => {
                if (w.set_type === "no_weight") return !best || s.reps > best.reps ? s : best;
                return !best || s.weight * s.reps > best.weight * best.reps ? s : best;
              }, null);
              return (
                <div key={w.id} className="grid grid-cols-[1fr_60px_72px_60px] gap-x-2 text-sm py-1 border-t border-border first:border-t-0">
                  <span className="truncate">{w.exercise?.name ?? "?"}</span>
                  <span className="text-right">{setCount}</span>
                  <span className="text-right">
                    {topSet == null ? "-" : w.set_type === "no_weight" ? "自重" : `${topSet.weight} kg`}
                  </span>
                  <span className="text-right">
                    {topSet == null ? "-" : `${topSet.reps}回`}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {!loadingDay && dayWorkouts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-red-500">
            <span>⏱</span>
            <span>合計セット数：{totalSets}セット</span>
          </div>
        )}
      </div>
    </>
  );
}
