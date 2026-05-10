"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth";

export default function LoginPage() {
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
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold tracking-wider mb-1">MUSCLE YAMATO</h1>
        <p className="text-muted text-sm mb-8">筋トレ記録アプリ</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-zinc-300 to-zinc-100 text-black font-bold rounded-xl py-3 disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="text-sm text-muted mt-6 text-center">
          アカウント未作成？ <Link href="/signup" className="text-white underline">新規登録</Link>
        </p>
      </div>
    </main>
  );
}
