import { describe, it, expect } from 'vitest';
import { genRunGrid, runGridUnlockable, runGridUnlock, autoPickRun, rerollRunGrid, runPassiveLevels } from '@domain/mining/runGrid';
import { createRng } from '@shared/rng';
import { PASSIVE_DEFS } from '@domain/mining/balance';

describe('domain/runGrid', () => {
  it('決定的: 同じシード・装備なら同じ配置', () => {
    const a = genRunGrid(123, 7, ['pick', 'bullet']);
    const b = genRunGrid(123, 7, ['pick', 'bullet']);
    expect(a.nodes.map((n) => n.pid)).toEqual(b.nodes.map((n) => n.pid));
    expect(a.size).toBe(7);
    expect(a.nodes.length).toBe(49);
  });

  it('中央は最初から解放・隣接が解放可能・遠いマスは不可', () => {
    const g = genRunGrid(1, 7, ['pick', 'bullet']);
    const cen = Math.floor((7 - 1) / 2);
    const rootIdx = cen * 7 + cen;
    expect(g.unlocked).toEqual([rootIdx]);
    const neighbor = g.nodes[rootIdx]!.requires[0]!;
    expect(runGridUnlockable(g, neighbor)).toBe(true);   // 隣接は解放可
    const corner = 0; // 左上＝中央から遠い
    expect(runGridUnlockable(g, corner)).toBe(false);    // 隣接していないので不可
  });

  it('解放で隣が現れる・集計される', () => {
    let g = genRunGrid(2, 7, ['pick', 'bullet']);
    const rootIdx = g.unlocked[0]!;
    const n0 = g.nodes[rootIdx]!.requires[0]!;
    g = runGridUnlock(g, n0);
    expect(g.unlocked).toContain(n0);
    const lv = runPassiveLevels(g);
    const total = Object.values(lv).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(2); // 中央＋1
  });

  it('自動解放: 解放可能なマスを返す（なければ null）', () => {
    const g = genRunGrid(3, 7, ['pick', 'bullet']);
    const rng = createRng(99);
    const i = autoPickRun(g, rng);
    expect(i).not.toBeNull();
    expect(runGridUnlockable(g, i!)).toBe(true);
  });

  it('武器固有バフは装備中の武器のものだけ出る', () => {
    const g = genRunGrid(7, 9, ['pick', 'bullet']); // bomb等は未装備
    const reqs = g.nodes.map((n) => PASSIVE_DEFS[n.pid].reqWeapon).filter((w): w is NonNullable<typeof w> => !!w);
    expect(reqs.every((w) => w === 'pick' || w === 'bullet')).toBe(true);
  });

  it('リロール: 未解放マスは変わりうる・解放済みと中央は不変', () => {
    let g = genRunGrid(5, 7, ['pick', 'bullet']);
    const rootIdx = g.unlocked[0]!;
    const before = g.nodes.map((n) => n.pid);
    g = rerollRunGrid(g, 555, ['pick', 'bullet']);
    expect(g.nodes[rootIdx]!.pid).toBe(before[rootIdx]); // 中央は不変
    expect(g.rerolls).toBe(1);
  });
});
