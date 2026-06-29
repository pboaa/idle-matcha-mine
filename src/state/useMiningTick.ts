import { useEffect } from 'react';
import { useMiningStore } from '@state/miningStore';
import { loadElapsedMs } from '@state/persistence';

/** 採掘モックのループ駆動（rAF→tick(dt)）＋離脱時セーブ＋バックグラウンド/オフライン進行（catchUp）。 */
export function useMiningTick(): void {
  const tick = useMiningStore((s) => s.tick);
  const catchUp = useMiningStore((s) => s.catchUp);
  const save = useMiningStore((s) => s.save);
  useEffect(() => {
    catchUp(loadElapsedMs()); // 起動時: タブを閉じていたぶん（前回セーブからの経過）を一括で進める。
    let last = performance.now();
    let hiddenAt = 0;
    let rafId = 0;
    let running = true;
    const loop = (now: number): void => {
      if (!running) return;
      tick(now - last);
      last = now;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    const onLeave = (): void => save();
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); save(); }
      else if (hiddenAt) { catchUp(Date.now() - hiddenAt); hiddenAt = 0; last = performance.now(); } // 復帰時: 隠れていたぶんを一括で進める。
    };
    window.addEventListener('beforeunload', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false; cancelAnimationFrame(rafId);
      window.removeEventListener('beforeunload', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      save();
    };
  }, [tick, catchUp, save]);
}
