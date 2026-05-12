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
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full bg-white border border-border rounded-xl px-4 py-3 outline-none focus:border-ink"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            className="w-full bg-white border border-border rounded-xl px-4 py-3 outline-none focus:border-ink"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button
            disabled={loading}
            className="w-full bg-ink text-white font-bold rounded-xl py-3 disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="text-sm text-muted mt-6 text-center">
          アカウント未作成？ <Link href="/signup" className="text-ink font-semibold underline">新規登録</Link>
        </p>
      </div>
    </main>
  );
}
