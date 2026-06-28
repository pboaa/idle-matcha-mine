import { describe, it, expect } from 'vitest';
import { kindAt, tileHardness, tileValue, baseOf, totalTilesOf } from '@domain/mining/tile';
import { defaultMiningBalance } from '@domain/mining/balance';

const B = defaultMiningBalance;

describe('mining/tile', () => {
  it('hardness は階で幾何級数的に増える', () => {
    expect(tileHardness(0, B)).toBe(1);
    expect(tileHardness(1, B)).toBeCloseTo(B.hardnessGrowth);
    expect(tileHardness(3, B)).toBeCloseTo(Math.pow(B.hardnessGrowth, 3));
    expect(tileHardness(5, B)).toBeGreaterThan(tileHardness(4, B)); // 単調増加
  });

  it('value は 種類×階(幾何)×コイン倍率', () => {
    const ore = B.kinds.ore; // mult 5
    expect(tileValue(ore, 0, 1, B)).toBe(5);   // coinMult 1・階0
    expect(tileValue(ore, 1, 1, B)).toBe(Math.round(5 * B.valueGrowth)); // 階+1
    expect(tileValue(ore, 0, 2, B)).toBe(10);  // coinMult 2
    expect(tileValue(ore, 5, 1, B)).toBeGreaterThan(tileValue(ore, 0, 1, B)); // 深い階ほどリッチ
  });

  it('kindAt は決定的（同じ座標・階で同じ）', () => {
    const c = { x: 3, y: 7 };
    expect(kindAt(c, 0, B).name).toBe(kindAt(c, 0, B).name);
  });

  it('深い階ほど rich が増える（土の割合が減る）', () => {
    const dirt = (floor: number): number => {
      let n = 0;
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (kindAt({ x, y }, floor, B) === B.kinds.dirt) n++;
      return n;
    };
    expect(dirt(8)).toBeLessThan(dirt(0));
  });

  it('base は中心、total は size^2', () => {
    expect(baseOf(B)).toEqual({ x: 15, y: 15 });
    expect(totalTilesOf(B)).toBe(900);
    expect(baseOf({ ...B, worldSize: 5 })).toEqual({ x: 2, y: 2 });
  });
});
