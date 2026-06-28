import { describe, it, expect } from 'vitest';
import { initialMineState } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { defaultMiningBalance } from '@domain/mining/balance';

describe('mining/step', () => {
  it('決定的（同じ初期状態・同じ時間で一致）', () => {
    const a = stepMine(initialMineState(), 10_000);
    const b = stepMine(initialMineState(), 10_000);
    expect(b.coins).toBe(a.coins);
    expect(b.dug.size).toBe(a.dug.size);
    expect(b.level).toBe(a.level);
    expect(b.cat.pos).toEqual(a.cat.pos);
  });

  it('掘って自動回収でコインが増える', () => {
    const s = stepMine(initialMineState(), 10_000);
    expect(s.dug.size).toBeGreaterThan(1);
    expect(s.coins).toBeGreaterThan(0);
  });

  it('猫は常に画面中心（cam = cat.pos）', () => {
    const s = stepMine(initialMineState(), 10_000);
    expect(s.cam).toEqual(s.cat.pos);
  });

  it('全部掘ると次の階へ（小ワールドで検証・balance注入）', () => {
    const small = { ...defaultMiningBalance, worldSize: 5 }; // 25マス
    let s = initialMineState(small);
    for (let i = 0; i < 60 && s.floor === 0; i++) s = stepMine(s, 5000, small);
    expect(s.floor).toBeGreaterThanOrEqual(1); // 掘り切って降りた
    expect(s.dug.size).toBeLessThan(5); // 新しい階はリセット
  });

  it('採掘ブースト(コイン購入)で武器の総ダメージが増える', () => {
    // 同一tick・同一乱数で boost の有無だけ比較（divergenceなし）。
    const base = { ...initialMineState(), autoMode: false };
    const sumDmg = (s: ReturnType<typeof stepMine>): number => Object.values(s.dmgByWeapon).reduce((a, b) => a + b, 0);
    const noBoost = sumDmg(stepMine(base, 100));
    const boosted = sumDmg(stepMine({ ...base, boost: 10 }, 100));
    expect(boosted).toBeGreaterThan(noBoost);            // 威力UP
    expect(boosted).toBeCloseTo(noBoost * 1.8, 5);       // +8%/Lv × 10 = ×1.8
  });

  it('自動モードでコインが目利き/ブーストに使われる（消費先がある）', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.meta.appraise + s.boost).toBeGreaterThan(0); // どちらかにコインが回る
  });

  it('自動モードでレベルアップ強化が乗る', () => {
    const s = stepMine(initialMineState(), 120_000);
    const total = Object.values(s.levels).reduce((a, b) => a + b, 0);
    expect(s.level).toBeGreaterThan(1);
    expect(total).toBeGreaterThan(1); // pick:1 + 取得分
    expect(s.offer).toBeNull();
  });
});
