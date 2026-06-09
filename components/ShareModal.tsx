"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDraft } from "@/lib/useDraft";
import type { BodyPart, SharedMenuItem, SetType } from "@/lib/types";
import { SET_TYPE_SHORT } from "@/lib/types";
import BodyPartIcon from "@/components/BodyPartIcon";

type PbInfo = { exerciseName: string; weight: number; reps: number; set_type: SetType } | null;

export default function ShareModal({
  bodyParts, menu, pbBeaten, onClose,
}: {
  bodyParts: BodyPart[];
  menu: SharedMenuItem[];
  pbBeaten: PbInfo;
  onClose: () => void;
}) {
  const [comment, setComment, clearComment] = useDraft<string>("share-comment", "");
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  // 閉じる時は下書きを破棄してから親のクローズ処理へ
  function handleClose() {
    clearComment();
    onClose();
  }

  async function share() {
    setSharing(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        body: comment.trim(),
        body_parts: bodyParts,
        menu,
        performed_at: new Date().toISOString(),
      });
      if (error) throw error;
      clearComment();
      setShared(true);
      setTimeout(onClose, 900);
    } catch (e: any) {
      alert(e.message ?? "共有に失敗しました");
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center sm:px-6">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {shared ? (
          <div className="text-center py-8 animate-celebrate">
            <div className="text-5xl mb-3">🎉</div>
            <div className="text-lg font-bold">共有しました！</div>
            <p className="text-muted text-sm mt-1">仲間が応援してくれるよ</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">💪</div>
              <h2 className="text-lg font-bold">お疲れさま！</h2>
              <p className="text-muted text-xs">今日のトレーニングを仲間に共有しよう</p>
            </div>

            {pbBeaten && (
              <div className="btn-metallic rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-sm mb-3">
                🏆 自己ベスト更新！{pbBeaten.exerciseName}{" "}
                {pbBeaten.set_type === "no_weight" ? `${pbBeaten.reps}回` : `${pbBeaten.weight}kg × ${pbBeaten.reps}回`}
              </div>
            )}

            {/* 部位 */}
            {bodyParts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {bodyParts.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 text-[11px] bg-surface border border-border rounded-full px-2 py-0.5">
                    <BodyPartIcon part={p} size={12} className="text-ink" />
                    {p}
                  </span>
                ))}
              </div>
            )}

            {/* メニュープレビュー */}
            <div className="bg-surface border border-border rounded-xl p-3 space-y-2 mb-3 max-h-48 overflow-y-auto">
              {menu.map((item, i) => (
                <div key={i}>
                  <div className="font-bold text-sm">{item.name}</div>
                  <ul className="mt-0.5 text-xs text-muted space-y-0.5">
                    {item.sets.map((s, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <span className="w-4 text-center">{j + 1}</span>
                        <span className="text-ink">
                          {s.set_type === "no_weight" ? `${s.reps}回（自重）` : `${s.weight}kg × ${s.reps}回`}
                        </span>
                        <span className="text-[9px] tracking-wider">{SET_TYPE_SHORT[s.set_type]}</span>
                        {s.has_assist && <span className="text-[9px]">🤝</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* コメント */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="一言コメント（任意）　例: 胸トレ追い込んだ！"
              rows={2}
              className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-ink resize-none mb-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleClose}
                disabled={sharing}
                className="border border-border rounded-xl py-3 text-center font-medium text-muted disabled:opacity-50"
              >スキップ</button>
              <button
                onClick={share}
                disabled={sharing}
                className="btn-navy rounded-xl py-3 font-bold disabled:opacity-50"
              >{sharing ? "共有中..." : "共有する"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
