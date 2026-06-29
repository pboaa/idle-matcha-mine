import { useEffect } from 'react';
import { useMiningStore } from '@state/miningStore';

/** 採掘モックのループ駆動（rAF→tick(dt)）＋離脱時セーブ。 */
export function useMiningTick(): void {
  const tick = useMiningStore((s) => s.tick);
  const save = useMiningStore((s) => s.save);
  useEffect(() => {
    let last = performance.now();
    let rafId = 0;
    let running = true;
    const loop = (now: number): void => {
      if (!running) return;
      tick(now - last);
      last = now;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    // タブを閉じる/隠れる時に即セーブ（自動セーブの取りこぼし防止）
    const onLeave = (): void => save();
    const onVisibility = (): void => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('beforeunload', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false; cancelAnimationFrame(rafId);
      window.removeEventListener('beforeunload', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      save();
    };
  }, [tick, save]);
}
