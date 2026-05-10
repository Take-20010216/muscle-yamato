"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BodyPart, Exercise } from "@/lib/types";
import { BODY_PARTS } from "@/lib/types";

type Props = {
  value: Exercise | null;
  onChange: (e: Exercise | null) => void;
  label?: string;
  defaultBodyPart?: BodyPart;
};

export default function ExercisePicker({ value, onChange, label = "種目", defaultBodyPart = "胸" }: Props) {
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBodyPart, setNewBodyPart] = useState<BodyPart>(defaultBodyPart);
  const [filter, setFilter] = useState<BodyPart | "all">("all");

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from("exercises").select("*").order("created_at", { ascending: false });
    if (data) setExercises(data as Exercise[]);
  }

  async function createExercise() {
    if (!newName.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("exercises")
      .insert({ user_id: user.id, name: newName.trim(), body_part: newBodyPart })
      .select()
      .single();
    if (!error && data) {
      onChange(data as Exercise);
      setOpen(false);
      setCreating(false);
      setNewName("");
    }
  }

  async function deleteExercise(id: string) {
    if (!confirm("この種目を削除しますか？関連する記録もすべて削除されます。")) return;
    const supabase = createClient();
    await supabase.from("exercises").delete().eq("id", id);
    if (value?.id === id) onChange(null);
    load();
  }

  const filtered = filter === "all" ? exercises : exercises.filter((e) => e.body_part === filter);

  return (
    <div>
      <label className="block text-sm text-muted mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-card border border-border rounded-xl px-4 py-4 flex items-center justify-between"
      >
        <span className={value ? "text-white" : "text-muted"}>{value ? value.name : "種目を選択"}</span>
        <span className="text-muted">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full max-w-md mx-auto rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">種目を選択</h3>
              <button onClick={() => setOpen(false)} className="text-muted">閉じる</button>
            </div>

            <div className="flex gap-2 mb-3 overflow-x-auto">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>すべて</FilterChip>
              {BODY_PARTS.map((b) => (
                <FilterChip key={b} active={filter === b} onClick={() => setFilter(b)}>{b}</FilterChip>
              ))}
            </div>

            <ul className="space-y-2 mb-4">
              {filtered.map((ex) => (
                <li key={ex.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <button className="text-left flex-1" onClick={() => { onChange(ex); setOpen(false); }}>
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-xs text-muted">{ex.body_part}</div>
                  </button>
                  <button onClick={() => deleteExercise(ex.id)} className="text-red-400 text-sm ml-3">削除</button>
                </li>
              ))}
              {filtered.length === 0 && <p className="text-muted text-sm">種目が登録されていません</p>}
            </ul>

            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full border border-dashed border-border rounded-xl py-3 text-muted"
              >
                ＋ 新しい種目を追加
              </button>
            ) : (
              <div className="space-y-2 bg-card p-3 rounded-xl border border-border">
                <input
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2"
                  placeholder="種目名（例: ベンチプレス）"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 overflow-x-auto">
                  {BODY_PARTS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setNewBodyPart(b)}
                      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${newBodyPart === b ? "bg-white text-black" : "bg-bg border border-border text-muted"}`}
                    >{b}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCreating(false)} className="flex-1 border border-border rounded-lg py-2">キャンセル</button>
                  <button type="button" onClick={createExercise} className="flex-1 bg-white text-black font-bold rounded-lg py-2">追加</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${active ? "bg-white text-black" : "bg-card border border-border text-muted"}`}>
      {children}
    </button>
  );
}
