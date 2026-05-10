"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const empty = (t: SetType): SetRow => t === "drop"
  ? { weight: "", reps: "", drop_weight: "", drop_reps: "" }
  : t === "super"
  ? { weight: "", reps: "", weight_b: "", reps_b: "" }
  : { weight: "", reps: "" };

export default function RecordForm() {
  const router = useRouter();
  const [setType, setSetType] = useState<SetType>("normal");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [exerciseB, setExerciseB] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetRow[]>([empty("normal"), empty("normal"), empty("normal")]);
  const [memo, setMemo] = useState("");
  const [pb, setPb] = useState<{ weight: number; reps: number; achieved_at: string } | null>(null);
  const [savedCelebrate, setSavedCelebrate] = useState(false);
  const [shareToTimeline, setShareToTimeline] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset rows when set type changes
  useEffect(() => { setSets(Array.from({ length: 3 }, () => empty(setType))); }, [setType]);

  // Load PB for selected exercise
  useEffect(() => {
    if (!exercise) { setPb(null); return; }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("personal_bests")
        .select("weight,reps,achieved_at")
        .eq("exercise_id", exercise.id)
        .order("achieved_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPb(data ? { weight: Number(data.weight), reps: Number(data.reps), achieved_at: data.achieved_at } : null);
    })();
  }, [exercise]);

  const bestNow = useMemo(() => {
    let best = 0; let bestW = 0; let bestR = 0;
    for (const s of sets) {
      const w = Number(s.weight) || 0; const r = Number(s.reps) || 0;
      if (w * r > best) { best = w * r; bestW = w; bestR = r; }
    }
    return { score: best, weight: bestW, reps: bestR };
  }, [sets]);

  const isPbBeaten = pb && bestNow.score > 0 && bestNow.score > setScore(pb.weight, pb.reps);
  const isFirstPb = !pb && bestNow.score > 0;

  function updateSet(i: number, patch: Partial<SetRow>) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addSet() { setSets((prev) => [...prev, empty(setType)]); }
  function removeSet(i: number) { setSets((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!exercise) { alert("種目を選択してください"); return; }
    if (setType === "super" && !exerciseB) { alert("スーパーセット用の2つ目の種目を選択してください"); return; }
    const valid = sets.filter((s) => Number(s.weight) > 0 && Number(s.reps) > 0);
    if (valid.length === 0) { alert("少なくとも1セットの重量と回数を入力してください"); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      const { data: w, error: werr } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          set_type: setType,
          exercise_id: exercise.id,
          exercise_id_b: setType === "super" ? exerciseB!.id : null,
          body_part: exercise.body_part,
          memo: memo || null,
        })
        .select()
        .single();
      if (werr) throw werr;

      const rows = valid.map((s, idx) => ({
        workout_id: w.id,
        set_index: idx + 1,
        weight: Number(s.weight),
        reps: Number(s.reps),
        drop_weight: setType === "drop" ? Number(s.drop_weight || 0) || null : null,
        drop_reps: setType === "drop" ? Number(s.drop_reps || 0) || null : null,
        weight_b: setType === "super" ? Number(s.weight_b || 0) || null : null,
        reps_b: setType === "super" ? Number(s.reps_b || 0) || null : null,
      }));
      const { error: serr } = await supabase.from("workout_sets").insert(rows);
      if (serr) throw serr;

      const beatsPb = pb ? bestNow.score > setScore(pb.weight, pb.reps) : bestNow.score > 0;
      if (shareToTimeline) {
        const body = beatsPb
          ? `${exercise.name} で自己ベスト更新！${bestNow.weight}kg × ${bestNow.reps}回🔥`
          : `${exercise.name} ${bestNow.weight}kg × ${bestNow.reps}回 達成💪`;
        await supabase.from("posts").insert({ user_id: user.id, body, workout_id: w.id });
      }

      if (beatsPb) {
        setSavedCelebrate(true);
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

  return (
    <main className="px-4 pt-6 pb-8">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">ワークアウト記録</h1>
        <button onClick={save} disabled={saving} className="text-sm text-zinc-300 disabled:opacity-50">{saving ? "保存中" : "保存"}</button>
      </header>

      <div className="mb-5">
        <ExercisePicker value={exercise} onChange={setExercise} label="種目" />
      </div>

      <div className="mb-5">
        <label className="block text-sm text-muted mb-2">セットタイプ</label>
        <div className="grid grid-cols-3 bg-card border border-border rounded-xl p-1">
          {(["normal", "drop", "super"] as SetType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSetType(t)}
              className={`py-2 text-xs tracking-wider rounded-lg ${setType === t ? "bg-white text-black font-bold" : "text-muted"}`}
            >
              {SET_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted text-center mt-2">{SET_TYPE_HINTS[setType]}</p>
      </div>

      {setType === "super" && (
        <div className="mb-5">
          <ExercisePicker value={exerciseB} onChange={setExerciseB} label="種目（2つ目）" />
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm text-muted mb-2">セットを記録</label>
        <div className="space-y-2">
          {sets.map((s, i) => (
            <SetRowInput
              key={i}
              index={i + 1}
              setType={setType}
              row={s}
              onChange={(patch) => updateSet(i, patch)}
              onRemove={() => removeSet(i)}
              canRemove={sets.length > 1}
              exerciseName={exercise?.name}
              exerciseBName={exerciseB?.name}
            />
          ))}
          <button type="button" onClick={addSet} className="w-full border border-dashed border-border rounded-xl py-3 text-muted">
            ＋ セットを追加
          </button>
        </div>
      </div>

      <div className="mb-5 bg-card border border-border rounded-xl p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">自己ベスト</span>
          <span className="text-[10px] tracking-wider bg-bg border border-border rounded px-2 py-0.5">BEST</span>
        </div>
        {pb ? (
          <div className="flex items-end gap-6">
            <div>
              <div className="text-xs text-muted">重量</div>
              <div className="text-2xl font-bold">{pb.weight}<span className="text-sm font-normal">kg</span></div>
            </div>
            <div>
              <div className="text-xs text-muted">回数</div>
              <div className="text-2xl font-bold">{pb.reps}<span className="text-sm font-normal">回</span></div>
            </div>
            <div className="ml-auto text-[10px] text-muted">更新日：{pb.achieved_at.slice(0, 10).replace(/-/g, ".")}</div>
          </div>
        ) : (
          <p className="text-muted text-sm">まだ記録がありません。最初のベストを刻もう！</p>
        )}
        {(isPbBeaten || isFirstPb) && (
          <div className="mt-4 bg-gradient-to-r from-zinc-300 to-zinc-100 text-black font-bold rounded-xl py-3 px-4 flex items-center justify-center gap-2">
            <span>🏆</span>{isPbBeaten ? "自己ベスト更新！" : "初のベスト達成！"}
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className="block text-sm text-muted mb-2">メモ（任意）</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="メモを入力..."
          className="w-full bg-card border border-border rounded-xl px-4 py-3 min-h-[100px] outline-none"
        />
      </div>

      <label className="flex items-center gap-2 mb-5 text-sm text-muted">
        <input type="checkbox" checked={shareToTimeline} onChange={(e) => setShareToTimeline(e.target.checked)} />
        この記録をタイムラインにも投稿する
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/" className="border border-border rounded-xl py-3 text-center">キャンセル</Link>
        <button onClick={save} disabled={saving} className="bg-gradient-to-r from-zinc-300 to-zinc-100 text-black font-bold rounded-xl py-3 disabled:opacity-50">
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>

      {savedCelebrate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6">
          <div className="bg-card border border-border rounded-2xl p-8 text-center animate-celebrate">
            <div className="text-5xl mb-3">🏆</div>
            <div className="text-xl font-bold mb-1">自己ベスト更新！</div>
            <p className="text-muted text-sm mb-2">{exercise?.name}</p>
            <p className="text-2xl font-bold">{bestNow.weight}kg × {bestNow.reps}回</p>
            <p className="text-zinc-300 text-sm mt-3">最高だ。次もこの調子で行こう。</p>
          </div>
        </div>
      )}
    </main>
  );
}

function SetRowInput({
  index, setType, row, onChange, onRemove, canRemove, exerciseName, exerciseBName,
}: {
  index: number; setType: SetType; row: SetRow;
  onChange: (p: Partial<SetRow>) => void; onRemove: () => void; canRemove: boolean;
  exerciseName?: string; exerciseBName?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-3">
        <div className="w-6 text-center text-muted">{index}</div>
        <NumberInput value={row.weight} onChange={(v) => onChange({ weight: v })} suffix="kg" placeholder="100" />
        <span className="text-muted">×</span>
        <NumberInput value={row.reps} onChange={(v) => onChange({ reps: v })} suffix="回" placeholder="5" />
        <button onClick={onRemove} disabled={!canRemove} className="text-muted disabled:opacity-30 ml-1">×</button>
      </div>
      {setType === "drop" && (
        <div className="flex items-center gap-3 mt-2 pl-9">
          <span className="text-[10px] text-muted">↓2段目</span>
          <NumberInput value={row.drop_weight ?? ""} onChange={(v) => onChange({ drop_weight: v })} suffix="kg" placeholder="50" />
          <span className="text-muted">×</span>
          <NumberInput value={row.drop_reps ?? ""} onChange={(v) => onChange({ drop_reps: v })} suffix="回" placeholder="5" />
          <span className="w-4" />
        </div>
      )}
      {setType === "super" && (
        <div className="flex items-center gap-3 mt-2 pl-9">
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
    <div className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 flex items-center">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent w-full outline-none text-right text-lg"
      />
      <span className="text-xs text-muted ml-1">{suffix}</span>
    </div>
  );
}
