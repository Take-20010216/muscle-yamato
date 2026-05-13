"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ExercisePicker from "@/components/ExercisePicker";
import RestTimer from "@/components/RestTimer";
import type { Exercise, SetType } from "@/lib/types";
import { SET_TYPE_HINTS, SET_TYPE_LABELS } from "@/lib/types";
import { setScore } from "@/lib/utils";

type SetRow = {
  weight: string; reps: string;
  drop_weight?: string; drop_reps?: string;
  weight_b?: string; reps_b?: string;
  _committed?: boolean; // タイマー自動起動済みフラグ
};

type LastSetHint = { weight: number; reps: number; setType?: SetType };

type Entry = {
  uid: string;
  setType: SetType;
  exercise: Exercise | null;
  exerciseB: Exercise | null;
  sets: SetRow[];
  memo: string;
  pb: { weight: number; reps: number; setType?: SetType } | null;
  lastSession: LastSetHint[] | null;
};

const newUid = () => Math.random().toString(36).slice(2, 9);
const empty = (t: SetType): SetRow => t === "drop"
  ? { weight: "", reps: "", drop_weight: "", drop_reps: "" }
  : t === "super"
  ? { weight: "", reps: "", weight_b: "", reps_b: "" }
  : { weight: "", reps: "" };

const makeEntry = (t: SetType = "normal", n = 3): Entry => ({
  uid: newUid(), setType: t, exercise: null, exerciseB: null,
  sets: Array.from({ length: n }, () => empty(t)), memo: "", pb: null, lastSession: null,
});

export default function RecordForm() {
  return (
    <Suspense fallback={<main className="px-4 pt-6"><p className="text-muted text-sm">読み込み中...</p></main>}>
      <RecordFormInner />
    </Suspense>
  );
}

function RecordFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const routineId = params.get("routine");
  const [entries, setEntries] = useState<Entry[]>(() => [makeEntry(), makeEntry(), makeEntry(), makeEntry()]);
  const [pbBeaten, setPbBeaten] = useState<{ exerciseName: string; weight: number; reps: number; setType: SetType } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRoutine, setLoadingRoutine] = useState(!!routineId);
  const [timerTrigger, setTimerTrigger] = useState<number | null>(null);
  const [defaultRest, setDefaultRest] = useState<number>(90);

  // localStorage で休憩時間を保存
  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("rest_seconds") : null;
    if (v) setDefaultRest(Number(v) || 90);
  }, []);
  function changeRest(v: number) {
    setDefaultRest(v);
    try { localStorage.setItem("rest_seconds", String(v)); } catch {}
  }

  async function fetchExerciseContext(exerciseId: string) {
    const supabase = createClient();
    const [pbRes, lastWRes] = await Promise.all([
      supabase
        .from("personal_bests")
        .select("weight,reps")
        .eq("exercise_id", exerciseId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workouts")
        .select("id,set_type")
        .eq("exercise_id", exerciseId)
        .order("performed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const pb = pbRes.data ? { weight: Number(pbRes.data.weight), reps: Number(pbRes.data.reps) } : null;
    let lastSession: LastSetHint[] | null = null;
    let lastSetType: SetType | undefined;
    if (lastWRes.data) {
      lastSetType = lastWRes.data.set_type as SetType;
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("set_index,weight,reps")
        .eq("workout_id", lastWRes.data.id)
        .order("set_index");
      if (sets && sets.length) {
        lastSession = sets.map((s) => ({ weight: Number(s.weight), reps: Number(s.reps), setType: lastSetType }));
      }
    }
    return { pb: pb ? { ...pb, setType: lastSetType } : null, lastSession };
  }

  useEffect(() => {
    if (!routineId) return;
    (async () => {
      const supabase = createClient();
      const { data: items } = await supabase
        .from("routine_items")
        .select("*, exercise:exercises!routine_items_exercise_id_fkey(*), exercise_b:exercises!routine_items_exercise_id_b_fkey(*)")
        .eq("routine_id", routineId)
        .order("position");
      if (items && items.length) {
        const loaded: Entry[] = items.map((it: any) => ({
          uid: newUid(),
          setType: it.set_type,
          exercise: it.exercise,
          exerciseB: it.exercise_b ?? null,
          sets: Array.from({ length: it.target_sets || 3 }, () => empty(it.set_type)),
          memo: "",
          pb: null,
          lastSession: null,
        }));
        setEntries(loaded);
        const ctxs = await Promise.all(loaded.map((e) => (e.exercise ? fetchExerciseContext(e.exercise.id) : Promise.resolve({ pb: null, lastSession: null }))));
        setEntries((prev) => prev.map((e, i) => ({ ...e, pb: ctxs[i].pb, lastSession: ctxs[i].lastSession })));
      }
      setLoadingRoutine(false);
    })();
  }, [routineId]);

  function updateEntry(uid: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e)));
  }
  function removeEntry(uid: string) {
    setEntries((prev) => prev.length > 1 ? prev.filter((e) => e.uid !== uid) : prev);
  }
  function addEntry() { setEntries((prev) => [...prev, makeEntry()]); }

  async function onExerciseChange(uid: string, ex: Exercise | null) {
    updateEntry(uid, { exercise: ex, pb: null, lastSession: null });
    if (!ex) return;
    const { pb, lastSession } = await fetchExerciseContext(ex.id);
    updateEntry(uid, { pb, lastSession });
  }

  // セットが「完了入力」されたらタイマー起動
  function onSetCommit() {
    setTimerTrigger(defaultRest);
  }

  async function saveAll() {
    const valid = entries.filter((e) => {
      if (!e.exercise) return false;
      if (e.setType === "no_weight") return e.sets.some((s) => Number(s.reps) > 0);
      return e.sets.some((s) => Number(s.weight) > 0 && Number(s.reps) > 0);
    });
    if (valid.length === 0) { alert("少なくとも1種目・1セットの記録が必要です"); return; }
    for (const e of valid) {
      if (e.setType === "super" && !e.exerciseB) { alert(`「${e.exercise?.name}」のスーパーセット用2種目目を選択してください`); return; }
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      let beatenInfo: { exerciseName: string; weight: number; reps: number; setType: SetType } | null = null;

      for (const e of valid) {
        const { data: w, error: werr } = await supabase
          .from("workouts")
          .insert({
            user_id: user.id,
            set_type: e.setType,
            exercise_id: e.exercise!.id,
            exercise_id_b: e.setType === "super" ? e.exerciseB!.id : null,
            body_part: e.exercise!.body_part,
            memo: e.memo || null,
          })
          .select()
          .single();
        if (werr) throw werr;

        const goodSets = e.sets.filter((s) =>
          e.setType === "no_weight" ? Number(s.reps) > 0 : (Number(s.weight) > 0 && Number(s.reps) > 0)
        );
        const rows = goodSets.map((s, idx) => ({
          workout_id: w.id,
          set_index: idx + 1,
          weight: e.setType === "no_weight" ? 0 : Number(s.weight),
          reps: Number(s.reps),
          drop_weight: e.setType === "drop" ? Number(s.drop_weight || 0) || null : null,
          drop_reps: e.setType === "drop" ? Number(s.drop_reps || 0) || null : null,
          weight_b: e.setType === "super" ? Number(s.weight_b || 0) || null : null,
          reps_b: e.setType === "super" ? Number(s.reps_b || 0) || null : null,
        }));
        const { error: serr } = await supabase.from("workout_sets").insert(rows);
        if (serr) throw serr;

        let bestScore = 0, bw = 0, br = 0;
        for (const s of goodSets) {
          const w = e.setType === "no_weight" ? 0 : Number(s.weight);
          const r = Number(s.reps);
          const sc = e.setType === "no_weight" ? r : w * r;
          if (sc > bestScore) { bestScore = sc; bw = w; br = r; }
        }
        const beforeScore = e.pb
          ? (e.setType === "no_weight" ? e.pb.reps : setScore(e.pb.weight, e.pb.reps))
          : 0;
        if (bestScore > beforeScore && !beatenInfo) {
          beatenInfo = { exerciseName: e.exercise!.name, weight: bw, reps: br, setType: e.setType };
        }
      }

      if (beatenInfo) {
        setPbBeaten(beatenInfo);
        setTimeout(() => router.push("/"), 1800);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e: any) {
      alert(e.message ?? "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loadingRoutine) {
    return <main className="px-4 pt-6"><p className="text-muted text-sm">ルーティン読み込み中...</p></main>;
  }

  return (
    <main className="px-4 pt-6 pb-8">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">ワークアウト記録</h1>
        <button onClick={saveAll} disabled={saving} className="text-sm text-ink font-semibold disabled:opacity-50">{saving ? "保存中" : "保存"}</button>
      </header>

      {/* 休憩時間プリセット選択 */}
      <div className="mb-4 bg-white border border-border rounded-xl p-3 flex items-center gap-2">
        <span className="text-xs text-muted">休憩</span>
        {[60, 90, 120, 180].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => changeRest(p)}
            className={`flex-1 py-1.5 rounded-lg text-xs ${defaultRest === p ? "tab-metallic-active" : "bg-surface text-muted"}`}
          >{p}秒</button>
        ))}
      </div>

      <div className="space-y-4">
        {entries.map((e, idx) => (
          <EntryCard
            key={e.uid}
            index={idx + 1}
            entry={e}
            onChange={(patch) => updateEntry(e.uid, patch)}
            onChangeExercise={(ex) => onExerciseChange(e.uid, ex)}
            onRemove={() => removeEntry(e.uid)}
            canRemove={entries.length > 1}
            onSetCommit={onSetCommit}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addEntry}
        className="w-full border border-dashed border-border rounded-xl py-4 text-muted mt-4 hover:bg-surface"
      >
        ＋ 種目を追加
      </button>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Link href="/" className="border border-border rounded-xl py-3 text-center font-medium">キャンセル</Link>
        <button onClick={saveAll} disabled={saving} className="btn-metallic rounded-xl py-3">
          {saving ? "保存中..." : "セッション終了"}
        </button>
      </div>

      <RestTimer triggerSeconds={timerTrigger} onTriggered={() => setTimerTrigger(null)} />

      {pbBeaten && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-6">
          <div className="bg-white border border-border rounded-2xl p-8 text-center animate-celebrate shadow-2xl">
            <div className="text-5xl mb-3">🏆</div>
            <div className="text-xl font-bold mb-1">自己ベスト更新！</div>
            <p className="text-muted text-sm mb-2">{pbBeaten.exerciseName}</p>
            <p className="text-2xl font-bold">
              {pbBeaten.setType === "no_weight" ? `${pbBeaten.reps}回` : `${pbBeaten.weight}kg × ${pbBeaten.reps}回`}
            </p>
            <p className="text-muted text-sm mt-3">最高だ。次もこの調子で行こう。</p>
          </div>
        </div>
      )}
    </main>
  );
}

function EntryCard({
  index, entry, onChange, onChangeExercise, onRemove, canRemove, onSetCommit,
}: {
  index: number; entry: Entry;
  onChange: (p: Partial<Entry>) => void;
  onChangeExercise: (ex: Exercise | null) => void;
  onRemove: () => void; canRemove: boolean;
  onSetCommit: () => void;
}) {
  function setType(t: SetType) {
    onChange({ setType: t, sets: entry.sets.map(() => empty(t)) });
  }
  function updateSet(i: number, patch: Partial<SetRow>) {
    onChange({ sets: entry.sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }
  function commitSet(i: number) {
    const s = entry.sets[i];
    if (s._committed) return;
    onChange({ sets: entry.sets.map((x, idx) => (idx === i ? { ...x, _committed: true } : x)) });
    onSetCommit();
  }
  function addSet() { onChange({ sets: [...entry.sets, empty(entry.setType)] }); }
  function removeSet(i: number) { onChange({ sets: entry.sets.filter((_, idx) => idx !== i) }); }

  const bestNow = useMemo(() => {
    let best = 0; let bw = 0; let br = 0;
    for (const s of entry.sets) {
      const w = entry.setType === "no_weight" ? 0 : (Number(s.weight) || 0);
      const r = Number(s.reps) || 0;
      const sc = entry.setType === "no_weight" ? r : (w * r);
      if (sc > best) { best = sc; bw = w; br = r; }
    }
    return { score: best, weight: bw, reps: br };
  }, [entry.sets, entry.setType]);

  const beforeScore = entry.pb
    ? (entry.setType === "no_weight" ? entry.pb.reps : setScore(entry.pb.weight, entry.pb.reps))
    : 0;
  const beatsPb = bestNow.score > 0 && bestNow.score > beforeScore;

  return (
    <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-muted">#{index}</span>
        {canRemove && <button onClick={onRemove} className="text-red-500 text-xs">削除</button>}
      </div>

      <ExercisePicker value={entry.exercise} onChange={onChangeExercise} label="" />

      <div className="grid grid-cols-4 bg-surface border border-border rounded-xl p-1 mt-3 gap-0.5">
        {(["normal", "drop", "super", "no_weight"] as SetType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`py-2 text-[10px] tracking-wider rounded-lg ${entry.setType === t ? "tab-metallic-active" : "text-muted"}`}
          >
            {SET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted text-center mt-2">{SET_TYPE_HINTS[entry.setType]}</p>

      {entry.setType === "super" && (
        <div className="mt-3">
          <ExercisePicker value={entry.exerciseB} onChange={(ex) => onChange({ exerciseB: ex })} label="種目（2つ目）" />
        </div>
      )}

      {entry.exercise && (
        <div className="mt-3 bg-surface border border-border rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted">自己ベスト</span>
          <span className="text-sm font-bold">
            {entry.pb
              ? (entry.pb.setType === "no_weight" ? `${entry.pb.reps}回` : `${entry.pb.weight}kg × ${entry.pb.reps}回`)
              : "未記録"}
          </span>
        </div>
      )}

      <div className="space-y-2 mt-3">
        {entry.sets.map((s, i) => (
          <SetRowInput
            key={i}
            index={i + 1}
            setType={entry.setType}
            row={s}
            onChange={(patch) => updateSet(i, patch)}
            onCommit={() => commitSet(i)}
            onRemove={() => removeSet(i)}
            canRemove={entry.sets.length > 1}
            exerciseBName={entry.exerciseB?.name}
            lastHint={entry.lastSession?.[i] ?? null}
          />
        ))}
        <button type="button" onClick={addSet} className="w-full border border-dashed border-border rounded-xl py-2 text-muted text-sm hover:bg-surface">
          ＋ セットを追加
        </button>
      </div>

      {beatsPb && (
        <div className="mt-3 btn-metallic rounded-xl py-2 px-4 flex items-center justify-center gap-2 text-sm">
          🏆 自己ベスト更新中！{entry.setType === "no_weight" ? `${bestNow.reps}回` : `${bestNow.weight}kg × ${bestNow.reps}回`}
        </div>
      )}

      <input
        value={entry.memo}
        onChange={(e) => onChange({ memo: e.target.value })}
        placeholder="メモ（任意）"
        className="w-full bg-white border border-border rounded-lg px-3 py-2 mt-3 text-sm outline-none focus:border-ink"
      />
    </div>
  );
}

function SetRowInput({
  index, setType, row, onChange, onCommit, onRemove, canRemove, exerciseBName, lastHint,
}: {
  index: number; setType: SetType; row: SetRow;
  onChange: (p: Partial<SetRow>) => void;
  onCommit: () => void;
  onRemove: () => void; canRemove: boolean;
  exerciseBName?: string;
  lastHint?: LastSetHint | null;
}) {
  const noWeight = setType === "no_weight";
  const hasValues = noWeight ? Number(row.reps) > 0 : (Number(row.weight) > 0 && Number(row.reps) > 0);

  return (
    <div className="bg-surface border border-border rounded-xl p-2.5">
      <div className="flex items-center gap-2">
        <div className="w-5 text-center text-muted text-sm">{index}</div>
        {!noWeight && (
          <>
            <NumberInput value={row.weight} onChange={(v) => onChange({ weight: v })} suffix="kg" placeholder="100" />
            <span className="text-muted">×</span>
          </>
        )}
        <NumberInput value={row.reps} onChange={(v) => onChange({ reps: v })} suffix="回" placeholder="5" />
        <button
          type="button"
          onClick={onCommit}
          disabled={!hasValues || row._committed}
          title={row._committed ? "タイマー起動済み" : "完了→タイマー起動"}
          className={`px-2 py-1 rounded-md text-xs ${row._committed ? "bg-surface text-muted" : "btn-metallic"} disabled:opacity-30`}
        >{row._committed ? "✓" : "⏱"}</button>
        <button onClick={onRemove} disabled={!canRemove} className="text-muted disabled:opacity-30 ml-1">×</button>
      </div>
      {lastHint && (
        <div className="pl-7 mt-1 text-[10px] text-muted">
          前回 {lastHint.setType === "no_weight" ? `${lastHint.reps}回` : `${lastHint.weight}kg × ${lastHint.reps}回`}
        </div>
      )}
      {setType === "drop" && (
        <div className="flex items-center gap-2 mt-1.5 pl-7">
          <span className="text-[10px] text-muted">↓2段目</span>
          <NumberInput value={row.drop_weight ?? ""} onChange={(v) => onChange({ drop_weight: v })} suffix="kg" placeholder="50" />
          <span className="text-muted">×</span>
          <NumberInput value={row.drop_reps ?? ""} onChange={(v) => onChange({ drop_reps: v })} suffix="回" placeholder="5" />
          <span className="w-4" />
        </div>
      )}
      {setType === "super" && (
        <div className="flex items-center gap-2 mt-1.5 pl-7">
          <span className="text-[10px] text-muted truncate max-w-[80px]">+ {exerciseBName ?? "種目B"}</span>
          <NumberInput value={row.weight_b ?? ""} onChange={(v) => onChange({ weight_b: v })} suffix="kg" placeholder="50" />
          <span className="text-muted">×</span>
          <NumberInput value={row.reps_b ?? ""} onChange={(v) => onChange({ reps_b: v })} suffix="回" placeholder="5" />
          <span className="w-4" />
        </div>
      )}
    </div>
  );
}

function NumberInput({ value, onChange, suffix, placeholder }: { value: string; onChange: (v: string) => void; suffix: string; placeholder?: string }) {
  return (
    <div className="flex-1 bg-white border border-border rounded-lg px-2 py-1.5 flex items-center">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent w-full outline-none text-right text-base"
      />
      <span className="text-xs text-muted ml-1">{suffix}</span>
    </div>
  );
}
