"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";
import { BODY_PARTS } from "@/lib/types";

export default function Settings() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: pr } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(pr);
    setDisplayName(pr?.display_name ?? pr?.username ?? "");
    const { data: ex } = await supabase.from("exercises").select("*").order("created_at", { ascending: false });
    setExercises((ex as Exercise[]) ?? []);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("profiles").update({ display_name: displayName.trim() || null }).eq("id", profile.id);
      load();
    } finally { setSaving(false); }
  }

  async function deleteExercise(id: string) {
    if (!confirm("この種目を削除しますか？関連するすべての記録も削除されます。")) return;
    const supabase = createClient();
    await supabase.from("exercises").delete().eq("id", id);
    load();
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">設定</h1>
        <span className="w-6" />
      </header>

      <section className="mb-6">
        <h2 className="text-sm tracking-widest text-muted mb-2">プロフィール</h2>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div>
            <div className="text-xs text-muted">ユーザー名</div>
            <div className="font-bold">{profile?.username ?? "-"}</div>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">表示名</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 outline-none"
            />
          </div>
          <button onClick={saveProfile} disabled={saving} className="w-full bg-white text-black font-bold rounded-lg py-2 disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm tracking-widest text-muted mb-2">種目の管理</h2>
        <div className="space-y-2">
          {exercises.length === 0 && <p className="text-muted text-sm">種目が登録されていません</p>}
          {BODY_PARTS.map((bp) => {
            const list = exercises.filter((e) => e.body_part === bp);
            if (list.length === 0) return null;
            return (
              <div key={bp} className="bg-card border border-border rounded-xl p-3">
                <div className="text-xs text-muted mb-1">{bp}</div>
                <ul className="space-y-1">
                  {list.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between py-1.5 border-t border-border first:border-0">
                      <span>{ex.name}</span>
                      <button onClick={() => deleteExercise(ex.id)} className="text-red-400 text-sm">削除</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-2">※ 種目を削除すると、その種目に紐づく記録もすべて削除されます。</p>
      </section>

      <section className="mb-6">
        <h2 className="text-sm tracking-widest text-muted mb-2">そのほか</h2>
        <div className="space-y-2">
          <Link href="/timeline" className="block bg-card border border-border rounded-xl px-4 py-3">タイムラインへ</Link>
          <button onClick={logout} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-left text-red-400">
            ログアウト
          </button>
        </div>
      </section>
    </main>
  );
}
