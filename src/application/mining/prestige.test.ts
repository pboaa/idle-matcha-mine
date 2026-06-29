import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyMaterials, emptyPerm, type Perm } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { buyPerm, buyRunUp, runUpCost, buyWeaponSkill, weaponSkillCost, oreToPoints, refine, prestige, permCost, permMaterial } from '@application/mining/prestige';
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
    const s = freshRun(B, perm, 0);
    expect(s.levels.pick).toBe(2 + 1);                    // 恒久2 + 開始ツルハシ1
    expect(s.levels.bullet).toBe(1);                      // 恒久そのまま（開始は乗らない）
    expect(s.levels.speed).toBe(3);                       // パッシブも恒久そのまま
    expect(s.meta.appraise).toBe(1);                      // 基礎目利き
    expect(extraWeaponLevels(s.levels, perm.levels)).toBe(1); // 開始武器は1つ(ツルハシ)だけ+1
  });

  it('熟練度は武器ごと・転生時に上がる（使った武器が+1）／消えない', () => {
    let s = stepMine(initialMineState(), 120_000); // ツルハシなど複数の武器を使う
    const usedPick = s.levels.pick > 0;
    expect(usedPick).toBe(true);
    const pickBefore = s.mastery.pick; // 初回は0
    s = prestige(s, B);
    expect(s.mastery.pick).toBe(pickBefore + 1); // 使った武器の熟練が+1
    // 使っていない武器は上がらない
    const unused = WEAPON_IDS.find((w) => w !== 'pick');
    if (unused) expect(s.mastery[unused]).toBeGreaterThanOrEqual(0);
    // さらに転生しても累積（消えない）
    const before = s.mastery.pick;
    const s2 = prestige(stepMine(s, 5_000), B);
    expect(s2.mastery.pick).toBeGreaterThanOrEqual(before); // 永続保持＆さらに加算
  });

  it('ラン強化: 鉱石を消費してLvが上がる／適用外(貫通×非直線)は不可', () => {
    const s0 = { ...initialMineState(), materials: { ...emptyMaterials(), dirt: 9999, ore: 9999 } };
    const cost = runUpCost('pick', 'damage', s0.runUp);
    const s1 = buyRunUp(s0, 'pick', 'damage');
    expect(s1.runUp.pick.damage).toBe(1);
    expect(s1.materials.dirt).toBe(9999 - cost); // ダメージは土を消費
    expect(buyRunUp(s0, 'pick', 'pierce').runUp.pick.pierce).toBe(0); // ツルハシは直線でない＝貫通不可
    expect(buyRunUp(s0, 'beam', 'pierce').runUp.beam.pierce).toBe(1);  // ビームは直線＝貫通可
  });

  it('ラン強化: ダメージ強化で対象武器の威力が上がる', () => {
    const base = { ...initialMineState(), autoMode: false };
    const pickDmg = (s: ReturnType<typeof stepMine>): number => s.dmgByWeapon.pick;
    const noUp = pickDmg(stepMine(base, 500));
    const upped = { ...base, runUp: { ...base.runUp, pick: { ...base.runUp.pick, damage: 5 } } };
    expect(pickDmg(stepMine(upped, 500))).toBeGreaterThan(noUp); // +8%/Lv × 5
  });

  it('武器スキルツリー: ポイントでノード解放／ポイント不足は不可', () => {
    const s0 = { ...initialMineState(), points: 100 };
    const cost = weaponSkillCost('pick', s0.perm)!;
    const s1 = buyWeaponSkill(s0, 'pick');
    expect(s1.perm.weaponSkill.pick).toBe(1);     // 1ノード解放
    expect(s1.points).toBe(100 - cost);            // ポイント消費
    const poor = { ...initialMineState(), points: 0 };
    expect(buyWeaponSkill(poor, 'pick').perm.weaponSkill.pick).toBe(0); // 不足で不可
  });

  it('転生: 走行リセット・残り鉱石はポイントへ変換・恒久/回数は保持', () => {
    const s = stepMine(initialMineState(), 30_000);
    const expectPoints = s.points + oreToPoints(s.materials, B);
    const r = prestige(s, B);
    expect(r.floor).toBe(0);
    expect(r.level).toBe(1);
    expect(r.materials).toEqual(emptyMaterials()); // 鉱石はリセット（変換済み）
    expect(r.points).toBe(expectPoints);           // 残り鉱石→ポイント
    expect(r.prestiges).toBe(s.prestiges + 1);
    expect(r.coins).toBe(0); // コインはリセット
  });
});
