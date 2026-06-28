import { useEffect } from 'react';
import { useMiningStore } from '@state/miningStore';

/** 採掘モックのループ駆動（rAF→tick(dt)）。最小版。 */
export function useMiningTick(): void {
  const tick = useMiningStore((s) => s.tick);
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
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [tick]);
}
