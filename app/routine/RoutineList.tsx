"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ExercisePicker from "@/components/ExercisePicker";
import type { Exercise, Routine, RoutineItem, SetType } from "@/lib/types";
import { SET_TYPE_LABELS } from "@/lib/types";

type FullRoutine = Routine & { items: (RoutineItem & { exercise?: Exercise; exercise_b?: Exercise | null })[] };

export default function RoutineList() {
  const [routines, setRoutines] = useState<FullRoutine[]>([]);
  const [editing, setEditing] = useState<FullRoutine | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: rs } = await supabase.from("routines").select("*").order("created_at", { ascending: false });
    if (!rs) { setRoutines([]); setLoading(false); return; }
    const full: FullRoutine[] = [];
    for (const r of rs as Routine[]) {
      const { data: items } = await supabase
        .from("routine_items")
        .select("*, exercise:exercises!routine_items_exercise_id_fkey(*), exercise_b:exercises!routine_items_exercise_id_b_fkey(*)")
        .eq("routine_id", r.id)
        .order("position");
      full.push({ ...r, items: (items as any) ?? [] });
    }
    setRoutines(full);
    setLoading(false);
  }

  async function deleteRoutine(id: string) {
    if (!confirm("このルーティンを削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("routines").delete().eq("id", id);
    load();
  }

  if (editing || creating) {
    return (
      <RoutineEditor
        routine={editing}
        onClose={() => { setEditing(null); setCreating(false); load(); }}
      />
    );
  }

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">ルーティン</h1>
        <button onClick={() => setCreating(true)} className="text-sm text-zinc-300">＋ 新規</button>
      </header>

      {loading && <p className="text-muted text-sm">読み込み中...</p>}
      {!loading && routines.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted text-sm">
          ルーティンがまだありません。<br/>右上の「＋ 新規」から作成しよう。
        </div>
      )}

      <div className="space-y-3">
        {routines.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">{r.name}</h3>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setEditing(r)} className="text-zinc-300">編集</button>
                <button onClick={() => deleteRoutine(r.id)} className="text-red-400">削除</button>
              </div>
            </div>
            {r.items.length === 0 ? (
              <p className="text-xs text-muted">種目未登録</p>
            ) : (
              <ul className="space-y-1.5">
                {r.items.map((it) => (
                  <li key={it.id} className="text-sm flex items-center gap-2">
                    <span className="text-[9px] tracking-wider bg-bg border border-border rounded px-1.5 py-0.5">{SET_TYPE_LABELS[it.set_type]}</span>
                    <span>{it.exercise?.name ?? "?"}</span>
                    {it.set_type === "super" && it.exercise_b && <span className="text-muted">＋ {it.exercise_b.name}</span>}
                    <span className="text-muted text-xs ml-auto">×{it.target_sets}セット</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function RoutineEditor({ routine, onClose }: { routine: FullRoutine | null; onClose: () => void }) {
  const isNew = !routine;
  const [name, setName] = useState(routine?.name ?? "");
  const [items, setItems] = useState<EditItem[]>(
    (routine?.items ?? []).map((it) => ({
      id: it.id,
      set_type: it.set_type,
      exercise: it.exercise ?? null,
      exercise_b: it.exercise_b ?? null,
      target_sets: it.target_sets,
    }))
  );
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItems((prev) => [...prev, { set_type: "normal", exercise: null, exercise_b: null, target_sets: 3 }]);
  }
  function updateItem(i: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!name.trim()) { alert("ルーティン名を入力してください"); return; }
    if (items.some((it) => !it.exercise)) { alert("すべての項目で種目を選択してください"); return; }
    if (items.some((it) => it.set_type === "super" && !it.exercise_b)) { alert("スーパーセットには2種目目を選択してください"); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      let routineId = routine?.id;
      if (isNew) {
        const { data, error } = await supabase.from("routines").insert({ user_id: user.id, name: name.trim() }).select().single();
        if (error) throw error; routineId = data.id;
      } else {
        await supabase.from("routines").update({ name: name.trim() }).eq("id", routineId!);
        await supabase.from("routine_items").delete().eq("routine_id", routineId!);
      }

      if (items.length) {
        const rows = items.map((it, idx) => ({
          routine_id: routineId!,
          position: idx,
          set_type: it.set_type,
          exercise_id: it.exercise!.id,
          exercise_id_b: it.set_type === "super" ? it.exercise_b!.id : null,
          target_sets: it.target_sets,
        }));
        const { error } = await supabase.from("routine_items").insert(rows);
        if (error) throw error;
      }
      onClose();
    } catch (e: any) {
      alert(e.message ?? "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-4 pt-6 pb-8">
      <header className="flex items-center justify-between mb-4">
        <button onClick={onClose} className="text-2xl">‹</button>
        <h1 className="font-bold">{isNew ? "ルーティン新規" : "ルーティン編集"}</h1>
        <button onClick={save} disabled={saving} className="text-sm text-zinc-300 disabled:opacity-50">{saving ? "保存中" : "保存"}</button>
      </header>

      <input
        className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none mb-5"
        placeholder="ルーティン名（例: 胸の日）"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="space-y-3 mb-4">
        {items.map((it, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-3 bg-bg border border-border rounded-lg p-1 flex-1">
                {(["normal", "drop", "super"] as SetType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateItem(i, { set_type: t })}
                    className={`py-1.5 text-[10px] tracking-wider rounded ${it.set_type === t ? "bg-white text-black font-bold" : "text-muted"}`}
                  >{SET_TYPE_LABELS[t]}</button>
                ))}
              </div>
              <button onClick={() => removeItem(i)} className="text-red-400 ml-3 text-sm">削除</button>
            </div>
            <ExercisePicker value={it.exercise} onChange={(e) => updateItem(i, { exercise: e })} label="種目" />
            {it.set_type === "super" && (
              <ExercisePicker value={it.exercise_b} onChange={(e) => updateItem(i, { exercise_b: e })} label="種目（2つ目）" />
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">目標セット数</span>
              <input
                type="number"
                inputMode="numeric"
                value={it.target_sets}
                onChange={(e) => updateItem(i, { target_sets: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20 bg-bg border border-border rounded-lg px-3 py-1.5 outline-none text-right"
              />
              <span className="text-sm text-muted">セット</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addItem} className="w-full border border-dashed border-border rounded-xl py-3 text-muted">
        ＋ 項目を追加
      </button>
    </main>
  );
}

type EditItem = {
  id?: string;
  set_type: SetType;
  exercise: Exercise | null;
  exercise_b: Exercise | null;
  target_sets: number;
};
