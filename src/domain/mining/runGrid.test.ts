import { describe, it, expect } from 'vitest';
import { genRunGrid, runGridUnlockable, runGridUnlock, runGridFull, runGridFilled, rerollRunGrid, runPassiveLevels } from '@domain/mining/runGrid';
import { PASSIVE_DEFS } from '@domain/mining/balance';

describe('domain/runGrid', () => {
  it('決定的: 同じシード・装備なら同じ配置', () => {
    const a = genRunGrid(123, 7, ['pick', 'bullet'], 99);
    const b = genRunGrid(123, 7, ['pick', 'bullet'], 99);
    expect(a.nodes.map((n) => n.pid)).toEqual(b.nodes.map((n) => n.pid));
    expect(a.size).toBe(7);
    expect(a.nodes.length).toBe(49);
  });

  it('中央は最初から解放・隣接が解放可能・遠いマスは不可', () => {
    const g = genRunGrid(1, 7, ['pick', 'bullet'], 99);
    const cen = Math.floor((7 - 1) / 2);
    const rootIdx = cen * 7 + cen;
    expect(g.unlocked).toEqual([rootIdx]);
    const neighbor = g.nodes[rootIdx]!.requires[0]!;
    expect(runGridUnlockable(g, neighbor)).toBe(true);   // 隣接は解放可
    const corner = 0; // 左上＝中央から遠い
    expect(runGridUnlockable(g, corner)).toBe(false);    // 隣接していないので不可
  });

  it('解放で隣が現れる・集計される', () => {
    let g = genRunGrid(2, 7, ['pick', 'bullet'], 99);
    const rootIdx = g.unlocked[0]!;
    const n0 = g.nodes[rootIdx]!.requires[0]!;
    g = runGridUnlock(g, n0);
    expect(g.unlocked).toContain(n0);
    const lv = runPassiveLevels(g);
    const total = Object.values(lv).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(2); // 中央＋1
  });

  it('上限(cap): cap 個まで解放したら満タン・それ以上は不可', () => {
    let g = genRunGrid(3, 7, ['pick', 'bullet'], 2); // 上限2
    expect(runGridFull(g)).toBe(false);
    // 中央隣から2つ解放
    for (let k = 0; k < 5 && !runGridFull(g); k++) {
      const i = g.nodes.map((_, idx) => idx).find((idx) => runGridUnlockable(g, idx));
      if (i === undefined) break;
      g = runGridUnlock(g, i);
    }
    expect(runGridFilled(g)).toBe(2);                    // 中央を除き2マス
    expect(runGridFull(g)).toBe(true);                  // 満タン
    expect(g.nodes.some((_, i) => runGridUnlockable(g, i))).toBe(false); // もう開けられない
  });

  it('武器固有バフは装備中の武器のものだけ出る', () => {
    const g = genRunGrid(7, 9, ['pick', 'bullet'], 99); // bomb等は未装備
    const reqs = g.nodes.map((n) => PASSIVE_DEFS[n.pid].reqWeapon).filter((w): w is NonNullable<typeof w> => !!w);
    expect(reqs.every((w) => w === 'pick' || w === 'bullet')).toBe(true);
  });

  it('貫通・射程(範囲)は走行グリッドに出ない（武器の基本値で扱う）', () => {
    for (const seed of [1, 2, 3, 50, 999]) {
      const g = genRunGrid(seed, 9, ['pick', 'bullet', 'beam'], 99);
      const effects = g.nodes.map((n) => PASSIVE_DEFS[n.pid].effect);
      expect(effects.some((e) => e === 'pierce' || e === 'range')).toBe(false);
    }
  });

  it('リロール: 未解放マスは変わりうる・解放済みと中央は不変', () => {
    let g = genRunGrid(5, 7, ['pick', 'bullet'], 99);
    const rootIdx = g.unlocked[0]!;
    const before = g.nodes.map((n) => n.pid);
    g = rerollRunGrid(g, 555, ['pick', 'bullet']);
    expect(g.nodes[rootIdx]!.pid).toBe(before[rootIdx]); // 中央は不変
    expect(g.rerolls).toBe(1);
  });
});
