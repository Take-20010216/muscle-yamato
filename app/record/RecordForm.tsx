"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ExercisePicker from "@/components/ExercisePicker";
import type { Exercise, SetType } from "@/lib/types";
import { SET_TYPE_HINTS, SET_TYPE_LABELS } from "@/lib/types";
import { setScore } from "@/lib/utils";

type SetRow = {
  weight: string; reps: string;
  drop_weight?: string; drop_reps?: string;
  weight_b?: string; reps_b?: string;
};

type Entry = {
  uid: string;
  setType: SetType;
  exercise: Exercise | null;
  exerciseB: Exercise | null;
  sets: SetRow[];
  memo: string;
  pb: { weight: number; reps: number } | null;
};

const newUid = () => Math.random().toString(36).slice(2, 9);
const empty = (t: SetType): SetRow => t === "drop"
  ? { weight: "", reps: "", drop_weight: "", drop_reps: "" }
  : t === "super"
  ? { weight: "", reps: "", weight_b: "", reps_b: "" }
  : { weight: "", reps: "" };

const makeEntry = (t: SetType = "normal", n = 3): Entry => ({
  uid: newUid(), setType: t, exercise: null, exerciseB: null,
  sets: Array.from({ length: n }, () => empty(t)), memo: "", pb: null,
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
  const [entries, setEntries] = useState<Entry[]>([makeEntry()]);
  const [pbBeaten, setPbBeaten] = useState<{ exerciseName: string; weight: number; reps: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRoutine, setLoadingRoutine] = useState(!!routineId);

  // Load routine items
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
        }));
        setEntries(loaded);
        // Load PB for each exercise in parallel
        const pbs = await Promise.all(loaded.map(async (e) => {
          if (!e.exercise) return null;
          const { data } = await supabase
            .from("personal_bests")
            .select("weight,reps")
            .eq("exercise_id", e.exercise.id)
            .limit(1)
            .maybeSingle();
          return data ? { weight: Number(data.weight), reps: Number(data.reps) } : null;
        }));
        setEntries((prev) => prev.map((e, i) => ({ ...e, pb: pbs[i] })));
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
    updateEntry(uid, { exercise: ex });
    if (!ex) { updateEntry(uid, { pb: null }); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from("personal_bests")
      .select("weight,reps")
      .eq("exercise_id", ex.id)
      .limit(1)
      .maybeSingle();
    updateEntry(uid, { pb: data ? { weight: Number(data.weight), reps: Number(data.reps) } : null });
  }

  async function saveAll() {
    const valid = entries.filter((e) => e.exercise && e.sets.some((s) => Number(s.weight) > 0 && Number(s.reps) > 0));
    if (valid.length === 0) { alert("少なくとも1種目・1セットの記録が必要です"); return; }
    for (const e of valid) {
      if (e.setType === "super" && !e.exerciseB) { alert(`「${e.exercise?.name}」のスーパーセット用2種目目を選択してください`); return; }
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      let beatenInfo: { exerciseName: string; weight: number; reps: number } | null = null;

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

        const goodSets = e.sets.filter((s) => Number(s.weight) > 0 && Number(s.reps) > 0);
        const rows = goodSets.map((s, idx) => ({
          workout_id: w.id,
          set_index: idx + 1,
          weight: Number(s.weight),
          reps: Number(s.reps),
          drop_weight: e.setType === "drop" ? Number(s.drop_weight || 0) || null : null,
          drop_reps: e.setType === "drop" ? Number(s.drop_reps || 0) || null : null,
          weight_b: e.setType === "super" ? Number(s.weight_b || 0) || null : null,
          reps_b: e.setType === "super" ? Number(s.reps_b || 0) || null : null,
        }));
        const { error: serr } = await supabase.from("workout_sets").insert(rows);
        if (serr) throw serr;

        // PB check for this entry
        let bestScore = 0, bw = 0, br = 0;
        for (const s of goodSets) {
          const sc = setScore(Number(s.weight), Number(s.reps));
          if (sc > bestScore) { bestScore = sc; bw = Number(s.weight); br = Number(s.reps); }
        }
        const beforeScore = e.pb ? setScore(e.pb.weight, e.pb.reps) : 0;
        if (bestScore > beforeScore && !beatenInfo) {
          beatenInfo = { exerciseName: e.exercise!.name, weight: bw, reps: br };
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
        <button onClick={saveAll} disabled={saving} className="bg-ink text-white font-bold rounded-xl py-3 disabled:opacity-50">
          {saving ? "保存中..." : "セッション終了"}
        </button>
      </div>

      {pbBeaten && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-6">
          <div className="bg-white border border-border rounded-2xl p-8 text-center animate-celebrate shadow-2xl">
            <div className="text-5xl mb-3">🏆</div>
            <div className="text-xl font-bold mb-1">自己ベスト更新！</div>
            <p className="text-muted text-sm mb-2">{pbBeaten.exerciseName}</p>
            <p className="text-2xl font-bold">{pbBeaten.weight}kg × {pbBeaten.reps}回</p>
            <p className="text-muted text-sm mt-3">最高だ。次もこの調子で行こう。</p>
          </div>
        </div>
      )}
    </main>
  );
}

function EntryCard({
  index, entry, onChange, onChangeExercise, onRemove, canRemove,
}: {
  index: number; entry: Entry;
  onChange: (p: Partial<Entry>) => void;
  onChangeExercise: (ex: Exercise | null) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  function setType(t: SetType) {
    onChange({ setType: t, sets: entry.sets.map(() => empty(t)) });
  }
  function updateSet(i: number, patch: Partial<SetRow>) {
    onChange({ sets: entry.sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }
  function addSet() { onChange({ sets: [...entry.sets, empty(entry.setType)] }); }
  function removeSet(i: number) { onChange({ sets: entry.sets.filter((_, idx) => idx !== i) }); }

  const bestNow = useMemo(() => {
    let best = 0; let bw = 0; let br = 0;
    for (const s of entry.sets) {
      const w = Number(s.weight) || 0; const r = Number(s.reps) || 0;
      if (w * r > best) { best = w * r; bw = w; br = r; }
    }
    return { score: best, weight: bw, reps: br };
  }, [entry.sets]);

  const beatsPb = entry.pb && bestNow.score > 0 && bestNow.score > setScore(entry.pb.weight, entry.pb.reps);

  return (
    <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-muted">#{index}</span>
        {canRemove && <button onClick={onRemove} className="text-red-500 text-sm">この種目を削除</button>}
      </div>

      <ExercisePicker value={entry.exercise} onChange={onChangeExercise} label="" />

      <div className="grid grid-cols-3 bg-surface border border-border rounded-xl p-1 mt-3">
        {(["normal", "drop", "super"] as SetType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`py-2 text-xs tracking-wider rounded-lg ${entry.setType === t ? "bg-white shadow-sm font-bold" : "text-muted"}`}
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
            {entry.pb ? `${entry.pb.weight}kg × ${entry.pb.reps}回` : "未記録"}
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
            onRemove={() => removeSet(i)}
            canRemove={entry.sets.length > 1}
            exerciseBName={entry.exerciseB?.name}
          />
        ))}
        <button type="button" onClick={addSet} className="w-full border border-dashed border-border rounded-xl py-2 text-muted text-sm hover:bg-surface">
          ＋ セットを追加
        </button>
      </div>

      {beatsPb && (
        <div className="mt-3 bg-ink text-white text-sm font-bold rounded-xl py-2 px-4 flex items-center justify-center gap-2">
          🏆 自己ベスト更新中！{bestNow.weight}kg × {bestNow.reps}回
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
  index, setType, row, onChange, onRemove, canRemove, exerciseBName,
}: {
  index: number; setType: SetType; row: SetRow;
  onChange: (p: Partial<SetRow>) => void; onRemove: () => void; canRemove: boolean;
  exerciseBName?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-2.5">
      <div className="flex items-center gap-2">
        <div className="w-5 text-center text-muted text-sm">{index}</div>
        <NumberInput value={row.weight} onChange={(v) => onChange({ weight: v })} suffix="kg" placeholder="100" />
        <span className="text-muted">×</span>
        <NumberInput value={row.reps} onChange={(v) => onChange({ reps: v })} suffix="回" placeholder="5" />
        <button onClick={onRemove} disabled={!canRemove} className="text-muted disabled:opacity-30 ml-1">×</button>
      </div>
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
