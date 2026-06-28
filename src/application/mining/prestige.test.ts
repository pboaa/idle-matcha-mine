import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyMaterials, emptyPerm, type Perm } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { buyPerm, refine, prestige, permCost, permMaterial } from '@application/mining/prestige';
import { defaultMiningBalance, WEAPON_IDS } from '@domain/mining/balance';

const B = defaultMiningBalance;
// 開始武器はランダムに1つ＝武器レベル合計は「恒久武器Lv合計 + 1」
const extraWeaponLevels = (levels: Record<string, number>, perm: Record<string, number>): number =>
  WEAPON_IDS.reduce((a, w) => a + ((levels[w] ?? 0) - (perm[w] ?? 0)), 0);

describe('mining/prestige', () => {
  it('採掘で素材がたまる（コインと別資源）', () => {
    const s = stepMine(initialMineState(), 8000);
    const totalMat = s.materials.dirt + s.materials.stone + s.materials.ore + s.materials.gem;
    expect(totalMat).toBeGreaterThan(0);
    expect(s.coins).toBeGreaterThan(0); // コインも別で増える
  });

  it('精錬: 8個の下位→1個の上位（土が腐らない）', () => {
    const s = { ...initialMineState(), materials: { ...emptyMaterials(), dirt: 20 } };
    const r = refine(s, 'dirt', B);
    expect(r.materials.dirt).toBe(20 - B.refineRatio);
    expect(r.materials.stone).toBe(1);
  });

  it('恒久強化: 素材を消費してレベルが上がる', () => {
    const mat = permMaterial('pick'); // 石
    const s = { ...initialMineState(), materials: { ...emptyMaterials(), [mat]: 9999 } };
    const cost = permCost('pick', s.perm, B);
    const r = buyPerm(s, 'pick', B);
    expect(r.perm.levels.pick).toBe(1);
    expect(r.materials[mat]).toBe(9999 - cost);
  });

  it('恒久強化は次走の開始レベルに乗る＋開始は必ずツルハシ（freshRun）', () => {
    const perm: Perm = { ...emptyPerm(), levels: { ...emptyPerm().levels, pick: 2, bullet: 1, speed: 3 }, appraise: 1 };
    const s = freshRun(B, emptyMaterials(), perm, 0);
    expect(s.levels.pick).toBe(2 + 1);                    // 恒久2 + 開始ツルハシ1
    expect(s.levels.bullet).toBe(1);                      // 恒久そのまま（開始は乗らない）
    expect(s.levels.speed).toBe(3);                       // パッシブも恒久そのまま
    expect(s.meta.appraise).toBe(1);                      // 基礎目利き
    expect(extraWeaponLevels(s.levels, perm.levels)).toBe(1); // 開始武器は1つ(ツルハシ)だけ+1
  });

  it('開始ブースト解放(perm.startBoost)は走行開始のブーストに乗る', () => {
    const perm: Perm = { ...emptyPerm(), startBoost: 4 };
    const s = freshRun(B, emptyMaterials(), perm, 0);
    expect(s.boost).toBe(4);
  });

  it('熟練度は転生しても消えない（永続）', () => {
    let s = stepMine(initialMineState(), 120_000); // レベルアップで熟練度が貯まる
    expect(s.masteryTotal).toBeGreaterThan(0);
    const before = s.masteryTotal;
    s = prestige(s, B);
    expect(s.masteryTotal).toBe(before); // 転生でも保持
  });

  it('転生: 走行はリセット、素材/恒久/回数は保持', () => {
    let s = stepMine(initialMineState(), 30_000);
    s = { ...s, perm: { ...s.perm, levels: { ...s.perm.levels, pick: 1 } } };
    const matsBefore = { ...s.materials };
    const r = prestige(s, B);
    expect(r.floor).toBe(0);
    expect(r.level).toBe(1);
    expect(r.levels.pick).toBe(1 + 1);       // 恒久pick1 + 開始ツルハシ1
    expect(r.materials).toEqual(matsBefore);  // 素材保持
    expect(r.prestiges).toBe(s.prestiges + 1);
    expect(r.coins).toBe(0); // コインはリセット
  });
});
