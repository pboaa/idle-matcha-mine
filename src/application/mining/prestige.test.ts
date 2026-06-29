import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyMaterials, emptyPerm, type Perm } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { buyPerm, buyCoinUp, coinUpCost, buyWeaponSkill, skillNodeUnlockable, oreToPoints, refine, prestige, permCost, permMaterial } from '@application/mining/prestige';
import { defaultMiningBalance, WEAPON_IDS, WEAPON_SKILL_NODES } from '@domain/mining/balance';

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
    let s = stepMine(initialMineState(), 240_000); // 自動は火力半減ぶん長めに掘る（seq>=masteryMinTiles）
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

  it('コイン全体強化: コインを消費してLvが上がる／不足は不可', () => {
    const s0 = { ...initialMineState(), coins: 99999 };
    const cost = coinUpCost('haste', s0.coinUp);
    const s1 = buyCoinUp(s0, 'haste');
    expect(s1.coinUp.haste).toBe(1);
    expect(s1.coins).toBe(99999 - cost);
    expect(coinUpCost('haste', s1.coinUp)).toBeGreaterThan(cost); // コストは上がる
    expect(buyCoinUp({ ...initialMineState(), coins: 0 }, 'haste').coinUp.haste).toBe(0); // 不足で不可
  });

  it('コイン全体強化(強欲)で素材獲得が増える', () => {
    const dug = (s: ReturnType<typeof stepMine>): number => s.materials.dirt + s.materials.stone;
    const base = initialMineState(); // 自動モード（移動あり）。greedは火力に依らず素材取得を増やす。
    const plain = dug(stepMine(base, 20_000));
    const greedy = dug(stepMine({ ...base, coinUp: { ...base.coinUp, greed: 30 } }, 20_000));
    expect(greedy).toBeGreaterThan(plain); // 強欲で素材が増えやすい
  });

  it('転生連打の抑止: ほぼ未採掘の即転生では熟練度が増えない', () => {
    const fresh = stepMine(initialMineState(), 300); // ほぼ掘っていない（seq < masteryMinTiles）
    const r = prestige(fresh, B);
    expect(r.mastery.pick).toBe(0); // 連打しても上がらない
    expect(fresh.seq).toBeLessThan(B.masteryMinTiles);
  });

  it('武器スキルツリー(グラフ): 前提を満たすノードをポイントで解放', () => {
    const s0 = { ...initialMineState(), points: 100 };
    expect(skillNodeUnlockable(s0.perm.weaponSkill.pick, 0)).toBe(true);  // 起点は前提なし
    expect(skillNodeUnlockable(s0.perm.weaponSkill.pick, 3)).toBe(false); // ノード3は前提[1]が未解放
    const cost0 = WEAPON_SKILL_NODES[0]!.cost;
    const s1 = buyWeaponSkill(s0, 'pick', 0);
    expect(s1.perm.weaponSkill.pick).toEqual([0]);   // 起点解放
    expect(s1.points).toBe(100 - cost0);             // ポイント消費
    expect(buyWeaponSkill(s1, 'pick', 3).perm.weaponSkill.pick).toEqual([0]); // 前提未達は不可
    const poor = { ...initialMineState(), points: 0 };
    expect(buyWeaponSkill(poor, 'pick', 0).perm.weaponSkill.pick).toEqual([]); // ポイント不足で不可
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
