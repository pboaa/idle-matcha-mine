import { describe, it, expect } from 'vitest';
import { kindAt, tileHardness, tileDist, tileValue, baseOf, totalTilesOf } from '@domain/mining/tile';
import { defaultMiningBalance, KINDS_BY_ID } from '@domain/mining/balance';

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
    // 種類: 土<銅<宝石（同じ位置でも上位ほど硬い）
    expect(tileHardness(0, 0, B.kinds.gem.hardMult, B)).toBeGreaterThan(tileHardness(0, 0, B.kinds.copper.hardMult, B));
    expect(tileHardness(0, 0, B.kinds.copper.hardMult, B)).toBeGreaterThan(tileHardness(0, 0, B.kinds.dirt.hardMult, B));
  });

  it('value は 種類×階(幾何)×コイン倍率', () => {
    const copper = B.kinds.copper; const m = copper.mult;
    expect(tileValue(copper, 0, 1, B)).toBe(m);   // coinMult 1・階0
    expect(tileValue(copper, 1, 1, B)).toBe(Math.round(m * B.valueGrowth)); // 階+1
    expect(tileValue(copper, 0, 2, B)).toBe(m * 2);  // coinMult 2
    expect(tileValue(copper, 5, 1, B)).toBeGreaterThan(tileValue(copper, 0, 1, B)); // 深い階ほどリッチ
  });

  it('kindAt は決定的（同じ座標・階で同じ）', () => {
    const c = { x: 3, y: 7 };
    expect(kindAt(c, 0, B).name).toBe(kindAt(c, 0, B).name);
  });

  it('深い階ほど rich が増える（土の割合が減る）', () => {
    const dirt = (floor: number): number => {
      let n = 0;
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (kindAt({ x, y }, floor, B) === KINDS_BY_ID.dirt) n++;
      return n;
    };
    expect(dirt(10)).toBeLessThan(dirt(0));
  });

  it('素材レア度は深さ連動（8段階）: 浅い階は上位が出ず、深い階で出る', () => {
    const count = (floor: number, kind: typeof KINDS_BY_ID.gem) => {
      let n = 0;
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (kindAt({ x, y }, floor, B) === kind) n++;
      return n;
    };
    expect(count(0, KINDS_BY_ID.gold)).toBe(0);   // 1階(floor0)では金なし
    expect(count(0, KINDS_BY_ID.gem)).toBe(0);    // 宝石もなし
    expect(count(0, KINDS_BY_ID.dirt)).toBeGreaterThan(800); // ほぼ土（900中）
    expect(count(B.matTiers[5]!.unlockFloor, KINDS_BY_ID.gold)).toBeGreaterThan(0);     // 金の解禁階で出る
    expect(count(B.matTiers[6]!.unlockFloor + 6, KINDS_BY_ID.gem)).toBeGreaterThan(0);  // 深い階で宝石が出る
  });

  it('base は中心、total は size^2', () => {
    const c = Math.floor(B.worldSize / 2);
    expect(baseOf(B)).toEqual({ x: c, y: c });
    expect(totalTilesOf(B)).toBe(B.worldSize * B.worldSize);
    expect(baseOf({ ...B, worldSize: 5 })).toEqual({ x: 2, y: 2 });
  });
});
