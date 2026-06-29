import { describe, it, expect } from 'vitest';
import { patternHits, stepToward, dirToward, type PatternInput } from '@domain/mining/patterns';
import type { Cell } from '@domain/grid/position';

const base = (over: Partial<PatternInput> = {}): PatternInput => ({
  pos: { x: 0, y: 0 }, target: { x: 5, y: 0 }, range: 3, lineRange: 3, spread: 0, targets: 1, rangeBase: 1,
  isSolid: () => true, ...over,
});
const key = (c: Cell): string => `${c.x},${c.y}`;
const totalFactor = (hits: { factor: number }[]): number => hits.reduce((a, h) => a + h.factor, 0);

describe('mining/patterns', () => {
  it('stepToward / dirToward は target 方向の隣接1マス', () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 5, y: 1 })).toEqual({ x: 1, y: 0 }); // x差が大きい
    expect(dirToward({ x: 0, y: 0 }, { x: 0, y: -3 })).toEqual({ x: 0, y: -1 });
  });

  it('front: 前方1マス→spreadで右→左→…と1マスずつ（spread2で3方向）', () => {
    expect(patternHits('front', base({ spread: 0 })).map((h) => key(h.cell))).toEqual(['1,0']);
    expect(new Set(patternHits('front', base({ spread: 2 })).map((h) => key(h.cell)))).toEqual(new Set(['1,0', '1,1', '1,-1']));
    expect(patternHits('front', base({ target: null }))).toEqual([]); // 目標なしは撃たない
    expect(patternHits('front', base()).every((h) => h.factor === 1)).toBe(true);
  });

  it('nearest: 固いマスを targets 個（factor=1）', () => {
    expect(patternHits('nearest', base({ targets: 1 })).length).toBe(1);
    expect(patternHits('nearest', base({ targets: 3 })).length).toBe(3);
    expect(patternHits('nearest', base({ targets: 3, isSolid: () => false }))).toEqual([]); // 固いマスが無ければ0
  });

  it('cross(ビーム): 方向は1本ずつ増える（基本2本→spread6で8本）・総威力は本数に依らず一定=2×lineRange', () => {
    const dirCount = (spread: number): number => new Set(patternHits('cross', base({ spread, lineRange: 3 })).map((h) => `${Math.sign(h.cell.x)},${Math.sign(h.cell.y)}`)).size;
    expect(dirCount(0)).toBe(2); expect(dirCount(1)).toBe(3); expect(dirCount(2)).toBe(4); // 1本ずつ
    expect(dirCount(6)).toBe(8); expect(dirCount(10)).toBe(8);                              // 最大8本（終盤）
    for (const sp of [0, 1, 3, 6]) expect(totalFactor(patternHits('cross', base({ spread: sp, lineRange: 3 })))).toBeCloseTo(6); // 化け防止＝総DPS一定
  });

  it('forward(ドリル): 横幅が増えても総威力一定', () => {
    const narrow = totalFactor(patternHits('forward', base({ spread: 0, lineRange: 4 })));
    const wide = totalFactor(patternHits('forward', base({ spread: 4, lineRange: 4 })));
    expect(wide).toBeCloseTo(narrow); // 横に広がっても総DPS一定
  });

  it('around(オーラ): 半径が増えても総威力一定（被覆だけ広がる）', () => {
    const r1 = totalFactor(patternHits('around', base({ range: 1, rangeBase: 1 })));
    const r3 = totalFactor(patternHits('around', base({ range: 3, rangeBase: 1 })));
    expect(r1).toBeCloseTo(9); expect(r3).toBeCloseTo(9); // (2*1+1)^2 ぶんで一定
  });

  it('ring(リング): 外周のみ・半径が増えても総威力一定', () => {
    const r2 = patternHits('ring', base({ range: 2, rangeBase: 2 }));
    expect(r2.every((h) => Math.max(Math.abs(h.cell.x), Math.abs(h.cell.y)) === 2)).toBe(true); // 外周のみ
    expect(totalFactor(patternHits('ring', base({ range: 2, rangeBase: 2 })))).toBeCloseTo(totalFactor(patternHits('ring', base({ range: 4, rangeBase: 2 }))));
  });

  it('burst(爆弾): 近い固いマス中心に (2*br+1)^2、spreadで拡大', () => {
    expect(patternHits('burst', base({ spread: 0 })).length).toBe(9);  // br=1 → 3x3
    expect(patternHits('burst', base({ spread: 2 })).length).toBe(25); // br=2 → 5x5
  });
});
