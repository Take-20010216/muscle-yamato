"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BodyPart, Exercise } from "@/lib/types";
import { BODY_PARTS } from "@/lib/types";
import { DEFAULT_EXERCISES } from "@/lib/defaults";

type Props = {
  value: Exercise | null;
  onChange: (e: Exercise | null) => void;
  label?: string;
  defaultBodyPart?: BodyPart;
};

let seedAttempted = false; // 同一セッション内で複数回シードしない

export default function ExercisePicker({ value, onChange, label = "種目", defaultBodyPart = "胸" }: Props) {
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBodyPart, setNewBodyPart] = useState<BodyPart>(defaultBodyPart);
  const [filter, setFilter] = useState<BodyPart | "all">("all");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from("exercises").select("*").order("created_at", { ascending: false });

    // 初回利用：種目0件ならデフォルト4種目×6部位をシード
    if (data && data.length === 0 && !seedAttempted) {
      seedAttempted = true;
      setSeeding(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const rows = DEFAULT_EXERCISES.map((d) => ({
            user_id: user.id, name: d.name, body_part: d.body_part,
          }));
          await supabase.from("exercises").insert(rows);
          const { data: reload } = await supabase.from("exercises").select("*").order("created_at", { ascending: false });
          if (reload) setExercises(reload as Exercise[]);
        }
      } finally { setSeeding(false); }
      return;
    }
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
      {label && <label className="block text-sm text-muted mb-2">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-white border border-border rounded-xl px-4 py-4 flex items-center justify-between hover:bg-surface"
      >
        <span className={value ? "text-ink font-medium" : "text-muted"}>{value ? value.name : "種目を選択"}</span>
        <span className="text-muted">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end" onClick={() => setOpen(false)}>
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">種目を選択</h3>
              <button onClick={() => setOpen(false)} className="text-muted">閉じる</button>
            </div>

            {seeding && (
              <p className="text-muted text-sm mb-3">デフォルト種目を準備中...</p>
            )}

            <div className="flex gap-2 mb-3 overflow-x-auto">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>すべて</FilterChip>
              {BODY_PARTS.map((b) => (
                <FilterChip key={b} active={filter === b} onClick={() => setFilter(b)}>{b}</FilterChip>
              ))}
            </div>

            <ul className="space-y-2 mb-4">
              {filtered.map((ex) => (
                <li key={ex.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <button className="text-left flex-1" onClick={() => { onChange(ex); setOpen(false); }}>
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-xs text-muted">{ex.body_part}</div>
                  </button>
                  <button onClick={() => deleteExercise(ex.id)} className="text-red-500 text-sm ml-3">削除</button>
                </li>
              ))}
              {!seeding && filtered.length === 0 && <p className="text-muted text-sm">種目が登録されていません</p>}
            </ul>

            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full border border-dashed border-border rounded-xl py-3 text-muted hover:bg-surface"
              >
                ＋ 新しい種目を追加
              </button>
            ) : (
              <div className="space-y-2 bg-surface p-3 rounded-xl border border-border">
                <input
                  className="w-full bg-white border border-border rounded-lg px-3 py-2"
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
                      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${newBodyPart === b ? "bg-ink text-white" : "bg-white border border-border text-muted"}`}
                    >{b}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCreating(false)} className="flex-1 border border-border rounded-lg py-2">キャンセル</button>
                  <button type="button" onClick={createExercise} className="flex-1 btn-metallic rounded-lg py-2">追加</button>
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
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${active ? "bg-ink text-white" : "bg-white border border-border text-muted"}`}>
      {children}
    </button>
  );
}
