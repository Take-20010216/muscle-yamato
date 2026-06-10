"use client";
import { createClient } from "@/lib/supabase/client";

// サーバー(Supabase)側の下書きストア。
// localStorage が消えても残るよう、入力内容を drafts テーブルに保存する。

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  // getSession はローカル(ストレージ)参照なのでネットワーク往復なしで高速
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function loadServerDraft<T>(key: string): Promise<T | null> {
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const supabase = createClient();
    const { data } = await supabase
      .from("drafts")
      .select("data")
      .eq("user_id", uid)
      .eq("key", key)
      .maybeSingle();
    return (data?.data as T) ?? null;
  } catch {
    return null;
  }
}

export async function saveServerDraft<T>(key: string, data: T): Promise<void> {
  try {
    const uid = await currentUserId();
    if (!uid) return;
    const supabase = createClient();
    await supabase
      .from("drafts")
      .upsert(
        { user_id: uid, key, data, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
  } catch {
    /* オフライン等は黙って無視（localStorageが控え） */
  }
}

export async function deleteServerDraft(key: string): Promise<void> {
  try {
    const uid = await currentUserId();
    if (!uid) return;
    const supabase = createClient();
    await supabase.from("drafts").delete().eq("user_id", uid).eq("key", key);
  } catch {
    /* noop */
  }
}
