"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fmtRelative } from "@/lib/utils";
import { REACTION_EMOJIS, SET_TYPE_SHORT } from "@/lib/types";
import type { Post, PostComment, SharedMenuItem, SetType } from "@/lib/types";
import BodyPartIcon from "@/components/BodyPartIcon";
import { useDraft } from "@/lib/useDraft";

type ProfileLite = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type ReactionRow = { post_id: string; user_id: string; emoji: string };

export default function CommunityFeed() {
  const [meId, setMeId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setMeId(user?.id ?? null);

    const { data: postData } = await supabase
      .from("posts")
      .select("id,user_id,body,body_parts,menu,performed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const ps = (postData ?? []) as Post[];
    setPosts(ps);

    if (ps.length === 0) {
      setProfiles({}); setReactions([]); setComments({});
      setLoading(false);
      return;
    }

    const postIds = ps.map((p) => p.id);
    const [reactRes, commentRes] = await Promise.all([
      supabase.from("post_reactions").select("post_id,user_id,emoji").in("post_id", postIds),
      supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", postIds).order("created_at", { ascending: true }),
    ]);
    const rx = (reactRes.data ?? []) as ReactionRow[];
    const cm = (commentRes.data ?? []) as PostComment[];
    setReactions(rx);
    const byPost: Record<string, PostComment[]> = {};
    for (const c of cm) (byPost[c.post_id] ||= []).push(c);
    setComments(byPost);

    // 投稿者＋コメント者のプロフィールをまとめて取得
    const userIds = Array.from(new Set([...ps.map((p) => p.user_id), ...cm.map((c) => c.user_id)]));
    const { data: profData } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", userIds);
    const pmap: Record<string, ProfileLite> = {};
    for (const pr of (profData ?? []) as ProfileLite[]) pmap[pr.id] = pr;
    setProfiles(pmap);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // リアクションのトグル（楽観的更新）
  async function toggleReaction(postId: string, emoji: string) {
    if (!meId) return;
    const supabase = createClient();
    const mine = reactions.some((r) => r.post_id === postId && r.user_id === meId && r.emoji === emoji);
    if (mine) {
      setReactions((prev) => prev.filter((r) => !(r.post_id === postId && r.user_id === meId && r.emoji === emoji)));
      await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", meId).eq("emoji", emoji);
    } else {
      setReactions((prev) => [...prev, { post_id: postId, user_id: meId, emoji }]);
      await supabase.from("post_reactions").insert({ post_id: postId, user_id: meId, emoji });
    }
  }

  async function addComment(postId: string, body: string) {
    if (!meId || !body.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: meId, body: body.trim() })
      .select("id,post_id,user_id,body,created_at")
      .single();
    if (data) {
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data as PostComment] }));
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("この投稿を削除しますか？")) return;
    const supabase = createClient();
    await supabase.from("posts").delete().eq("id", postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (loading) return <p className="text-muted text-sm">読み込み中...</p>;

  if (posts.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center shadow-sm">
        <div className="text-4xl mb-2">🏋️</div>
        <p className="text-sm font-bold mb-1">まだ投稿がありません</p>
        <p className="text-muted text-xs">トレーニングを記録して、最初の1件を共有しよう！</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          author={profiles[post.user_id]}
          profiles={profiles}
          reactions={reactions.filter((r) => r.post_id === post.id)}
          comments={comments[post.id] ?? []}
          meId={meId}
          onToggleReaction={(emoji) => toggleReaction(post.id, emoji)}
          onAddComment={(body) => addComment(post.id, body)}
          onDelete={() => deletePost(post.id)}
        />
      ))}
    </div>
  );
}

function displayName(p?: ProfileLite) {
  if (!p) return "名無し";
  return p.display_name || p.username || "名無し";
}

function PostCard({
  post, author, profiles, reactions, comments, meId, onToggleReaction, onAddComment, onDelete,
}: {
  post: Post;
  author?: ProfileLite;
  profiles: Record<string, ProfileLite>;
  reactions: ReactionRow[];
  comments: PostComment[];
  meId: string | null;
  onToggleReaction: (emoji: string) => void;
  onAddComment: (body: string) => void;
  onDelete: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useDraft<string>(`comment:${post.id}`, "");
  const isMine = meId != null && post.user_id === meId;

  // 絵文字ごとの集計
  const counts: Record<string, number> = {};
  const mineSet = new Set<string>();
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (r.user_id === meId) mineSet.add(r.emoji);
  }

  const name = displayName(author);
  const initial = name.slice(0, 1);

  return (
    <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
          {author?.avatar_url
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
            : initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate">{name}</div>
          <div className="text-[11px] text-muted">{fmtRelative(post.created_at)}</div>
        </div>
        {isMine && (
          <button onClick={onDelete} className="text-muted text-xs px-1">削除</button>
        )}
      </div>

      {/* 部位チップ */}
      {post.body_parts && post.body_parts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {post.body_parts.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 text-[11px] bg-surface border border-border rounded-full px-2 py-0.5">
              <BodyPartIcon part={p} size={12} className="text-ink" />
              {p}
            </span>
          ))}
        </div>
      )}

      {/* コメント本文 */}
      {post.body && <p className="mt-2.5 text-sm whitespace-pre-wrap">{post.body}</p>}

      {/* メニュー */}
      {post.menu && post.menu.length > 0 && (
        <div className="mt-3 bg-surface border border-border rounded-xl p-3 space-y-2">
          {post.menu.map((item, i) => (
            <MenuItemView key={i} item={item} />
          ))}
        </div>
      )}

      {/* リアクションバー */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {REACTION_EMOJIS.map((emoji) => {
          const c = counts[emoji] ?? 0;
          const active = mineSet.has(emoji);
          return (
            <button
              key={emoji}
              onClick={() => onToggleReaction(emoji)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs transition ${
                active ? "bg-navy/10 border-navy text-navy font-bold" : "bg-white border-border text-muted"
              }`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              {c > 0 && <span>{c}</span>}
            </button>
          );
        })}
      </div>

      {/* コメントトグル */}
      <button
        onClick={() => setShowComments((v) => !v)}
        className="mt-3 text-xs text-muted"
      >
        💬 コメント{comments.length > 0 ? ` (${comments.length})` : ""} {showComments ? "▲" : "▼"}
      </button>

      {showComments && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <span className="font-bold shrink-0">{displayName(profiles[c.user_id])}</span>
              <span className="text-ink/90 whitespace-pre-wrap break-words">{c.body}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  onAddComment(draft);
                  setDraft("");
                }
              }}
              placeholder="コメントを書く..."
              className="flex-1 bg-white border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ink"
            />
            <button
              onClick={() => { onAddComment(draft); setDraft(""); }}
              disabled={!draft.trim()}
              className="btn-navy rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"
            >送信</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItemView({ item }: { item: SharedMenuItem }) {
  return (
    <div>
      <div className="font-bold text-sm">{item.name}</div>
      <ul className="mt-0.5 text-xs text-muted space-y-0.5">
        {item.sets.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-4 text-center">{i + 1}</span>
            <span className="text-ink">
              {s.set_type === "no_weight" ? `${s.reps}回（自重）` : `${s.weight}kg × ${s.reps}回`}
            </span>
            <span className="text-[9px] tracking-wider">{SET_TYPE_SHORT[s.set_type as SetType]}</span>
            {s.has_assist && <span className="text-[9px]">🤝</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
