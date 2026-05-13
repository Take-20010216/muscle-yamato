"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  // 親から「タイマー開始」を呼ぶためのトリガー（秒数を渡すと起動）
  triggerSeconds?: number | null;
  onTriggered?: () => void;
};

const PRESETS = [60, 90, 120, 180];

export default function RestTimer({ triggerSeconds, onTriggered }: Props) {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(90);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number>(0);

  // 外部トリガーで起動
  useEffect(() => {
    if (triggerSeconds && triggerSeconds > 0) {
      start(triggerSeconds);
      onTriggered?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSeconds]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function start(sec: number) {
    setDuration(sec);
    setRemaining(sec);
    setRunning(true);
    setOpen(true);
    startedAtRef.current = Date.now();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const left = sec - elapsed;
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        fireAlert();
      } else {
        setRemaining(left);
      }
    }, 250);
  }

  function stop() {
    setRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function fireAlert() {
    // 振動（iPhone PWA→Apple Watch にミラーリングされる）
    try { (navigator as any).vibrate?.([200, 100, 200, 100, 400]); } catch {}
    // ビープ音
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.25;
      o.start();
      setTimeout(() => { o.frequency.value = 660; }, 200);
      setTimeout(() => { o.stop(); ctx.close(); }, 600);
    } catch {}
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = duration > 0 ? (1 - remaining / duration) * 100 : 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 btn-metallic rounded-full px-4 py-3 text-sm shadow-lg"
      >
        ⏱ タイマー
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 left-4 max-w-md mx-auto z-40">
      <div className="bg-white border border-border rounded-2xl shadow-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs tracking-widest text-muted">休憩タイマー</span>
          <button onClick={() => { stop(); setOpen(false); }} className="text-muted text-sm">閉じる</button>
        </div>

        {running ? (
          <div>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full bg-red-500 ${running ? "animate-pulse-ring" : ""}`} />
              <div className="text-5xl font-bold tabular-nums">{mm}:{ss}</div>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-3">
              <div className="h-full bg-ink transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={stop} className="border border-border rounded-lg py-2 text-sm">停止</button>
              <button onClick={() => start(remaining + 30)} className="border border-border rounded-lg py-2 text-sm">+30s</button>
              <button onClick={() => start(duration)} className="btn-metallic rounded-lg py-2 text-sm">リセット</button>
            </div>
          </div>
        ) : (
          <div>
            {remaining === 0 && duration > 0 && (
              <p className="text-center text-sm font-bold mb-2">⏰ 休憩終了！</p>
            )}
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => start(p)}
                  className="btn-metallic rounded-lg py-3 text-sm"
                >
                  {p}秒
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
