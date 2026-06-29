import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyMaterials, emptyPerm, emptyMastery } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { defaultMiningBalance, WEAPON_IDS } from '@domain/mining/balance';

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
    expect(s.dug.size).toBeLessThan(25 / 2); // 新しい階はリセット（満タン25マスから大きく減っている）
  });

  it('採掘ブースト(コイン購入)で武器の総ダメージが増える', () => {
    // 同一乱数で boost の有無だけ比較（divergenceなし）。手動＝目標を前方の壁に固定してツルハシを撃たせる。
    const base = { ...initialMineState(), autoMode: false, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 16, y: 15 } } };
    const sumDmg = (s: ReturnType<typeof stepMine>): number => Object.values(s.dmgByWeapon).reduce((a, b) => a + b, 0);
    const noBoost = sumDmg(stepMine(base, 500));
    const boosted = sumDmg(stepMine({ ...base, boost: 10 }, 500));
    expect(boosted).toBeGreaterThan(noBoost);            // 威力UP
    expect(boosted).toBeCloseTo(noBoost * 1.8, 5);       // +8%/Lv × 10 = ×1.8
  });

  it('コインは貯まり、強化購入は手動（自動購入はしない）', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.coins).toBeGreaterThan(0);   // コインは貯まる（使い道は手動）
    expect(s.meta.appraise).toBe(0);      // 自動では目利きを買わない
    expect(s.boost).toBe(0);              // 自動ではブーストも買わない
  });

  it('熟練度(永続)は周回で序盤を速くする（合計熟練の移動/射程スループット）', () => {
    const masteryAll = (n: number) => { const m = emptyMastery(); for (const w of WEAPON_IDS) m[w] = n; return m; };
    const fresh = (n: number) => freshRun(defaultMiningBalance, emptyMaterials(), emptyPerm(), 0, 123456, masteryAll(n));
    const low = stepMine(fresh(0), 120_000);
    const high = stepMine(fresh(20), 120_000); // 周回を重ねた状態（各武器+20）
    // 累計採掘量（階×総タイル + その階の採掘）で比較＝より多く掘れている＝サクサク
    expect(high.dug.size + high.floor * 900).toBeGreaterThan(low.dug.size + low.floor * 900);
  });

  it('手動の3択は一定時間(offerAutoMs)放置で自動選択される', () => {
    const B = defaultMiningBalance;
    const ch = { id: 'power', rarity: 'common', bonus: null } as const;
    const base = initialMineState();
    // 既に3択が出てから offerAutoMs 経過した状態（xpは低くして新規offerが出ないように）
    const s0 = { ...base, autoMode: false, offer: [ch, ch, ch], offerAt: 0, time: B.offerAutoMs + 100, xp: 0 };
    const s1 = stepMine(s0, 100);
    expect(s1.offer).toBeNull();                                  // 放置で自動選択
    expect(s1.levels.power).toBeGreaterThan(base.levels.power);   // 何か取得された
  });

  it('武器の命中エフェクト(fx)が生成され寿命内に保たれる', () => {
    const s = stepMine(initialMineState(), 3000);
    expect(s.fx.length).toBeGreaterThan(0);                       // 演出が出る
    expect(s.fx.every((f) => s.time - f.bornAt < defaultMiningBalance.fxVisualMs)).toBe(true); // 古いものは消える
    expect(s.fx.every((f) => f.cells.length > 0)).toBe(true);     // 当たったマスを持つ
    expect(s.fx.every((f) => Number.isFinite(f.origin.x) && Number.isFinite(f.origin.y))).toBe(true); // 発射元(線描画用)
    expect(s.fx.some((f) => f.weapon === 'pick')).toBe(true);     // 初期武器ツルハシの演出
  });

  it('自動モードでレベルアップ強化が乗る', () => {
    const s = stepMine(initialMineState(), 120_000);
    const total = Object.values(s.levels).reduce((a, b) => a + b, 0);
    expect(s.level).toBeGreaterThan(1);
    expect(total).toBeGreaterThan(1); // pick:1 + 取得分
    expect(s.offer).toBeNull();
  });
});
