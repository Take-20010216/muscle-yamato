"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (password.length < 6) throw new Error("パスワードは6文字以上で設定してください");
      const supabase = createClient();
      const email = usernameToEmail(username);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() } },
      });
      if (error) throw error;
      // Supabaseはデフォルトでメール確認が有効。AUTH_DOMAINがダミーなので
      // 確認メールは届かない。Supabase Dashboard → Authentication → Providers → Email
      // で "Confirm email" をOFFにすること（READMEで案内）。
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold tracking-wider mb-1">MUSCLE YAMATO</h1>
        <p className="text-muted text-sm mb-8">新規登録</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none"
            placeholder="ユーザー名（半角英数字）"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none"
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-zinc-300 to-zinc-100 text-black font-bold rounded-xl py-3 disabled:opacity-50"
          >
            {loading ? "登録中..." : "登録してはじめる"}
          </button>
        </form>
        <p className="text-sm text-muted mt-6 text-center">
          すでにアカウント？ <Link href="/login" className="text-white underline">ログイン</Link>
        </p>
      </div>
    </main>
  );
}
