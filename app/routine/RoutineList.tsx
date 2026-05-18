"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ExercisePicker from "@/components/ExercisePicker";
import BodyPartIcon from "@/components/BodyPartIcon";
import type { Exercise, Routine, RoutineItem, BodyPart } from "@/lib/types";
import { BODY_PARTS, isFullBody } from "@/lib/types";

type FullRoutine = Routine & { items: (RoutineItem & { exercise?: Exercise; exercise_b?: Exercise | null })[] };

export default function RoutineList() {
  const router = useRouter();
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

    const ids = (rs as Routine[]).map((r) => r.id);
    let itemsByRoutine: Record<string, any[]> = {};
    if (ids.length) {
      const { data: items } = await supabase
        .from("routine_items")
        .select("*, exercise:exercises!routine_items_exercise_id_fkey(*), exercise_b:exercises!routine_items_exercise_id_b_fkey(*)")
        .in("routine_id", ids)
        .order("position");
      for (const it of (items ?? []) as any[]) (itemsByRoutine[it.routine_id] ||= []).push(it);
    }
    setRoutines((rs as Routine[]).map((r) => ({ ...r, items: itemsByRoutine[r.id] ?? [] })));
    setLoading(false);
  }

  async function deleteRoutine(id: string) {
    if (!confirm("このルーティンを削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("routines").delete().eq("id", id);
    load();
  }

  function startRoutine(id: string) {
    router.push(`/record?routine=${id}`);
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
        <button onClick={() => setCreating(true)} className="text-sm text-ink font-semibold">＋ 新規</button>
      </header>

      {loading && <p className="text-muted text-sm">読み込み中...</p>}
      {!loading && routines.length === 0 && (
        <div className="bg-white border border-border rounded-xl p-6 text-center text-muted text-sm">
          ルーティンがまだありません。<br/>右上の「＋ 新規」から作成しよう。
        </div>
      )}

      <div className="space-y-3">
        {routines.map((r) => (
          <div key={r.id} className="bg-white border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">{r.name}</h3>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setEditing(r)} className="text-ink">編集</button>
                <button onClick={() => deleteRoutine(r.id)} className="text-red-500">削除</button>
              </div>
            </div>
            {r.body_parts && r.body_parts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {r.body_parts.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 text-[11px] bg-surface border border-border rounded-full px-2 py-0.5">
                    <BodyPartIcon part={p} size={14} className="text-red-500" />
                    {p}
                  </span>
                ))}
              </div>
            )}
            {r.items.length === 0 ? (
              <p className="text-xs text-muted">種目未登録</p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {r.items.map((it) => (
                  <li key={it.id} className="text-sm flex items-center gap-2">
                    <span>{it.exercise?.name ?? "?"}</span>
                    {it.exercise_b && <span className="text-muted">＋ {it.exercise_b.name}</span>}
                    <span className="text-muted text-xs ml-auto">×{it.target_sets}セット</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => startRoutine(r.id)}
              disabled={r.items.length === 0}
              className="w-full btn-metallic rounded-xl py-2.5 disabled:opacity-30"
            >
              このルーティンで開始 →
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

type EditItem = {
  id?: string;
  exercise: Exercise | null;
  exercise_b: Exercise | null;
  target_sets: number;
};

function RoutineEditor({ routine, onClose }: { routine: FullRoutine | null; onClose: () => void }) {
  const isNew = !routine;
  const [name, setName] = useState(routine?.name ?? "");
  const [bodyParts, setBodyParts] = useState<BodyPart[]>(routine?.body_parts ?? []);
  const [items, setItems] = useState<EditItem[]>(
    (routine?.items ?? []).map((it) => ({
      id: it.id,
      exercise: it.exercise ?? null,
      exercise_b: it.exercise_b ?? null,
      target_sets: it.target_sets,
    }))
  );
  const [saving, setSaving] = useState(false);

  function togglePart(p: BodyPart) {
    setBodyParts((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (p === "全身") return ["全身"];
      const filtered = prev.filter((x) => x !== "全身");
      if (filtered.length >= 3) return filtered;
      return [...filtered, p];
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { exercise: null, exercise_b: null, target_sets: 3 }]);
  }
  function updateItem(i: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!name.trim()) { alert("ルーティン名を入力してください"); return; }
    if (items.some((it) => !it.exercise)) { alert("すべての項目で種目を選択してください"); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      let routineId = routine?.id;
      if (isNew) {
        const { data, error } = await supabase
          .from("routines")
          .insert({ user_id: user.id, name: name.trim(), body_parts: bodyParts })
          .select()
          .single();
        if (error) throw error; routineId = data.id;
      } else {
        await supabase
          .from("routines")
          .update({ name: name.trim(), body_parts: bodyParts })
          .eq("id", routineId!);
        await supabase.from("routine_items").delete().eq("routine_id", routineId!);
      }

      if (items.length) {
        const rows = items.map((it, idx) => ({
          routine_id: routineId!,
          position: idx,
          exercise_id: it.exercise!.id,
          exercise_id_b: it.exercise_b?.id ?? null,
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
        <button onClick={save} disabled={saving} className="text-sm text-ink font-semibold disabled:opacity-50">{saving ? "保存中" : "保存"}</button>
      </header>

      <input
        className="w-full bg-white border border-border rounded-xl px-4 py-3 outline-none mb-3 focus:border-ink"
        placeholder="ルーティン名（例: 胸の日）"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="bg-white border border-border rounded-xl p-3 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">部位（最大3）</span>
          <span className="text-[10px] text-muted">{bodyParts.length}/3</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {BODY_PARTS.map((p) => {
            const active = bodyParts.includes(p);
            const disabled =
              !active &&
              ((p === "全身" && bodyParts.length > 0) ||
                (p !== "全身" && (isFullBody(bodyParts) || bodyParts.length >= 3)));
            return (
              <button
                key={p}
                type="button"
                onClick={() => !disabled && togglePart(p)}
                disabled={disabled}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs ${
                  active ? "bg-ink text-bg border-ink" : "bg-white border-border text-ink"
                } ${disabled ? "opacity-40" : ""}`}
              >
                <BodyPartIcon part={p} size={16} className={active ? "text-bg" : "text-red-500"} />
                <span>{p}</span>
                {active && <span className="ml-0.5">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {items.map((it, i) => (
          <div key={i} className="bg-white border border-border rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">種目 #{i + 1}</span>
              <button onClick={() => removeItem(i)} className="text-red-500 text-sm">削除</button>
            </div>
            <ExercisePicker value={it.exercise} onChange={(e) => updateItem(i, { exercise: e })} label="種目" />
            <ExercisePicker
              value={it.exercise_b}
              onChange={(e) => updateItem(i, { exercise_b: e })}
              label="スーパーセット用2種目目（任意）"
            />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">目標セット数</span>
              <input
                type="number"
                inputMode="numeric"
                value={it.target_sets}
                onChange={(e) => updateItem(i, { target_sets: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20 bg-white border border-border rounded-lg px-3 py-1.5 outline-none text-right"
              />
              <span className="text-sm text-muted">セット</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addItem} className="w-full border border-dashed border-border rounded-xl py-3 text-muted hover:bg-surface">
        ＋ 項目を追加
      </button>
    </main>
  );
}
