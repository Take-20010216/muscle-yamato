"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fmtRelative } from "@/lib/utils";

type PostRow = {
  id: string; user_id: string; body: string; created_at: string;
  profile: { username: string; display_name: string | null } | null;
};

export default function Timeline() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [body, setBody] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);

    const { data } = await supabase
      .from("posts")
      .select("id,user_id,body,created_at, profile:profiles!posts_user_id_fkey(username,display_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data as any) ?? []);

    const ids = (data ?? []).map((p: any) => p.id);
    if (ids.length) {
      const { data: ls } = await supabase.from("post_likes").select("post_id,user_id").in("post_id", ids);
      const lk: Record<string, { count: number; mine: boolean }> = {};
      for (const id of ids) lk[id] = { count: 0, mine: false };
      for (const l of ls ?? []) {
        lk[l.post_id].count++;
        if (l.user_id === user?.id) lk[l.post_id].mine = true;
      }
      setLikes(lk);

      const { data: cs } = await supabase
        .from("post_comments")
        .select("id,post_id,user_id,body,created_at, profile:profiles!post_comments_user_id_fkey(username,display_name)")
        .in("post_id", ids)
        .order("created_at");
      const cm: Record<string, any[]> = {};
      for (const c of (cs ?? []) as any[]) (cm[c.post_id] ||= []).push(c);
      setComments(cm);
    }
  }

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("posts").insert({ user_id: user.id, body: body.trim() });
      setBody("");
      load();
    } finally { setPosting(false); }
  }

  async function toggleLike(postId: string) {
    if (!me) return;
    const supabase = createClient();
    const cur = likes[postId];
    if (cur?.mine) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me);
      setLikes((p) => ({ ...p, [postId]: { count: cur.count - 1, mine: false } }));
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: me });
      setLikes((p) => ({ ...p, [postId]: { count: (cur?.count ?? 0) + 1, mine: true } }));
    }
  }

  async function addComment(postId: string) {
    if (!draft.trim() || !me) return;
    const supabase = createClient();
    await supabase.from("post_comments").insert({ post_id: postId, user_id: me, body: draft.trim() });
    setDraft("");
    load();
  }

  async function deletePost(id: string) {
    if (!confirm("この投稿を削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("posts").delete().eq("id", id);
    load();
  }

  async function deleteComment(id: string) {
    if (!confirm("このコメントを削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("post_comments").delete().eq("id", id);
    load();
  }

  return (
    <main className="px-4 pt-6">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">タイムライン</h1>
        <span className="w-6" />
      </header>

      <div className="bg-card border border-border rounded-xl p-3 mb-5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="今日のトレーニングをシェア..."
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 outline-none min-h-[80px]"
        />
        <div className="flex justify-end mt-2">
          <button onClick={post} disabled={posting || !body.trim()} className="bg-white text-black font-bold rounded-lg px-4 py-1.5 text-sm disabled:opacity-40">
            {posting ? "投稿中..." : "投稿"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {posts.length === 0 && <p className="text-muted text-sm text-center py-8">投稿がありません</p>}
        {posts.map((p) => (
          <article key={p.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm">
                {(p.profile?.display_name ?? p.profile?.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{p.profile?.display_name ?? p.profile?.username ?? "ユーザー"}</div>
                <div className="text-[10px] text-muted">{fmtRelative(p.created_at)}</div>
              </div>
              {p.user_id === me && (
                <button onClick={() => deletePost(p.id)} className="text-red-400 text-xs">削除</button>
              )}
            </div>

            <p className="text-sm whitespace-pre-wrap mb-3">{p.body}</p>

            <div className="flex items-center gap-4 text-sm text-muted">
              <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1 ${likes[p.id]?.mine ? "text-pink-400" : ""}`}>
                {likes[p.id]?.mine ? "❤" : "♡"} {likes[p.id]?.count ?? 0}
              </button>
              <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)} className="flex items-center gap-1">
                💬 {comments[p.id]?.length ?? 0}
              </button>
            </div>

            {openComments === p.id && (
              <div className="mt-3 border-t border-border pt-3 space-y-2">
                {(comments[p.id] ?? []).map((c) => (
                  <div key={c.id} className="bg-bg border border-border rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span>{c.profile?.display_name ?? c.profile?.username ?? "ユーザー"} ・ {fmtRelative(c.created_at)}</span>
                      {c.user_id === me && <button onClick={() => deleteComment(c.id)} className="text-red-400">削除</button>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="コメントを書く..."
                    className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 outline-none text-sm"
                  />
                  <button onClick={() => addComment(p.id)} className="bg-white text-black font-bold rounded-lg px-3 text-sm">送信</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
