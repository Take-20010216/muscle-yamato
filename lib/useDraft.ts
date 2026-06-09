"use client";
import { useEffect, useRef, useState } from "react";

const PREFIX = "muscle:draft:";

/** localStorage から下書きを1回だけ読み出す（マウント時の初期値用）。 */
export function readDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) return JSON.parse(raw) as T;
  } catch {
    /* JSON破損などは無視して初期値にフォールバック */
  }
  return null;
}

/** 指定キーの下書きを削除する。 */
export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

/**
 * 入力内容を localStorage に自動保存する useState。
 * - ページ遷移・アプリ切替・リロードで値が消えなくなる。
 * - clear() で明示的に下書きを破棄できる（保存成功時などに呼ぶ）。
 *
 * @param key      下書きの識別子（"muscle:draft:" が自動で前置される）
 * @param initial  初期値（または初期値を返す関数）
 * @param enabled  false の間は読み書きしない（例: ルーティン読込中）
 */
export function useDraft<T>(
  key: string,
  initial: T | (() => T),
  enabled = true
): readonly [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => {
    const base = typeof initial === "function" ? (initial as () => T)() : initial;
    if (!enabled) return base;
    const saved = readDraft<T>(key);
    return saved != null ? saved : base;
  });

  // clear 後の書き戻しを防ぐためのフラグ
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!enabled || clearedRef.current) return;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* 容量超過などは黙って無視 */
    }
  }, [key, value, enabled]);

  const clear = () => {
    clearedRef.current = true;
    clearDraft(key);
  };

  return [value, setValue, clear] as const;
}
