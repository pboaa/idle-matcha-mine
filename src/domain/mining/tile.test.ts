import { describe, it, expect } from 'vitest';
import { kindAt, tileHardness, tileDist, tileValue, baseOf, totalTilesOf } from '@domain/mining/tile';
import { defaultMiningBalance } from '@domain/mining/balance';

const B = defaultMiningBalance;

describe('mining/tile', () => {
  it('hardness は階で幾何級数的に増える（拠点距離0・基準種類で基準）', () => {
    expect(tileHardness(0, 0, 1, B)).toBe(B.hardnessBase);
    expect(tileHardness(1, 0, 1, B)).toBeCloseTo(B.hardnessBase * B.hardnessGrowth);
    expect(tileHardness(3, 0, 1, B)).toBeCloseTo(B.hardnessBase * Math.pow(B.hardnessGrowth, 3));
    expect(tileHardness(5, 0, 1, B)).toBeGreaterThan(tileHardness(4, 0, 1, B)); // 単調増加
  });

  it('hardness は拠点から離れるほど＆上位鉱石ほど固い', () => {
    const base = baseOf(B);
    expect(tileDist(base, B)).toBe(0);
    expect(tileDist({ x: base.x + 5, y: base.y }, B)).toBe(5); // チェビシェフ距離
    expect(tileHardness(0, 5, 1, B)).toBeGreaterThan(tileHardness(0, 0, 1, B)); // 外側ほど固い
    expect(tileHardness(0, 5, 1, B)).toBeCloseTo(B.hardnessBase * (1 + 5 * B.distHardness));
    // 種類: 土<石<鉱石<宝石（同じ位置でも硬い）
    expect(tileHardness(0, 0, B.kinds.gem.hardMult, B)).toBeGreaterThan(tileHardness(0, 0, B.kinds.ore.hardMult, B));
    expect(tileHardness(0, 0, B.kinds.ore.hardMult, B)).toBeGreaterThan(tileHardness(0, 0, B.kinds.dirt.hardMult, B));
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

  it('素材レア度は深さ連動: 浅い階は鉱石/宝石が出ず、深い階で出る', () => {
    const count = (floor: number, kind: typeof B.kinds.ore) => {
      let n = 0;
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (kindAt({ x, y }, floor, B) === kind) n++;
      return n;
    };
    expect(count(0, B.kinds.ore)).toBe(0);   // 1階(floor0)では鉱石(金)なし
    expect(count(0, B.kinds.gem)).toBe(0);   // 宝石(ダイヤ)もなし
    expect(count(0, B.kinds.dirt)).toBeGreaterThan(800); // ほぼ土（900中）
    expect(count(B.kindThresh.oreFloor, B.kinds.ore)).toBeGreaterThan(0);   // 解禁階で鉱石が出る
    expect(count(B.kindThresh.gemFloor + 4, B.kinds.gem)).toBeGreaterThan(0); // 深い階で宝石が出る
  });

  it('base は中心、total は size^2', () => {
    expect(baseOf(B)).toEqual({ x: 15, y: 15 });
    expect(totalTilesOf(B)).toBe(900);
    expect(baseOf({ ...B, worldSize: 5 })).toEqual({ x: 2, y: 2 });
  });
});
