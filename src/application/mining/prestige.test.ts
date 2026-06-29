import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyMaterials, emptyPerm, type Perm } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { buyPerm, buyCoinUp, coinUpCost, buyWeaponSkill, skillNodeUnlockable, allowedWeapons, weaponUnlockCost, unlockWeapon, refine, prestige, permCost, permMaterial } from '@application/mining/prestige';
import { defaultMiningBalance, WEAPON_IDS, BASE_WEAPONS, weaponSkillNodes } from '@domain/mining/balance';

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

  it('序盤は武器2種のみ・★で解放できる（基本武器は不可）', () => {
    const s = { ...initialMineState(), points: 999 };
    expect([...allowedWeapons(s.perm)]).toEqual([...BASE_WEAPONS]); // 最初は2種
    const cost = weaponUnlockCost(s.perm);
    const r = unlockWeapon(s, 'beam');
    expect(r.perm.weaponUnlocks).toEqual(['beam']); // 解放された
    expect(r.points).toBe(999 - cost);              // ★消費
    expect(allowedWeapons(r.perm)).toContain('beam');
    expect(weaponUnlockCost(r.perm)).toBeGreaterThan(cost); // 次は高い
    expect(unlockWeapon(s, 'pick').points).toBe(999); // 基本武器は解放対象外（消費なし）
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
    // 独立した新規state（stepMineはdugを破壊的更新するので使い回さない）。手動＋目標で同じ採掘量。
    const make = (greed: number) => ({ ...initialMineState(), autoMode: false, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 0, y: 0 } }, coinUp: { haste: 0, greed, luck: 0 } });
    const plain = dug(stepMine(make(0), 20_000));
    const greedy = dug(stepMine(make(30), 20_000));
    expect(greedy).toBeGreaterThan(plain); // 強欲で素材が増えやすい
  });


  it('武器スキルツリー(グラフ): 前提を満たすノードをポイントで解放', () => {
    const nodes = weaponSkillNodes('pick');
    const gated = nodes.findIndex((n) => n.requires.length > 0); // 前提のあるノード
    const s0 = { ...initialMineState(), points: 9999 };
    expect(skillNodeUnlockable('pick', [], 0)).toBe(true);          // 起点は前提なし
    expect(skillNodeUnlockable('pick', [], gated)).toBe(false);     // 前提が未解放
    expect(buyWeaponSkill(s0, 'pick', gated).perm.weaponSkill.pick).toEqual([]); // 前提未達は不可
    const s1 = buyWeaponSkill(s0, 'pick', 0);
    expect(s1.perm.weaponSkill.pick).toEqual([0]);                 // 起点解放
    expect(s1.points).toBe(9999 - nodes[0]!.cost);                // ポイント消費
    const poor = { ...initialMineState(), points: 0 };
    expect(buyWeaponSkill(poor, 'pick', 0).perm.weaponSkill.pick).toEqual([]); // ポイント不足で不可
  });

  it('武器スキルツリーは+5%ダメージ系が大量・武器ごとに形が違う', () => {
    const pick = weaponSkillNodes('pick'); const beam = weaponSkillNodes('beam');
    expect(pick.length).toBeGreaterThan(8);                         // ノードがいっぱい
    expect(pick.filter((n) => n.stat === 'damage').length).toBeGreaterThan(pick.length / 2); // 過半が+ダメージ
    expect(pick.map((n) => `${n.x},${n.y}`).join('|')).not.toBe(beam.map((n) => `${n.x},${n.y}`).join('|')); // 形が違う
  });

  it('転生: 走行リセット・鉱石/★/恒久/回数は保持', () => {
    const s = stepMine(initialMineState(), 30_000);
    const r = prestige(s, B);
    expect(r.floor).toBe(0);
    expect(r.level).toBe(1);
    expect(r.materials).toEqual(s.materials); // 鉱石は永続保存（変換しない）
    expect(r.points).toBe(s.points + s.runPoints); // ★は保持＋走行中の獲得予定をまとめて付与
    expect(r.prestiges).toBe(s.prestiges + 1);
    expect(r.coins).toBe(0); // コインはリセット
  });

  it('転生: 閾値以上のダメージを出した武器だけ熟練+1（未満は据え置き・閾値はLvで上昇）', () => {
    const s = stepMine(initialMineState(), 60_000); // ツルハシで掘ってダメージを稼ぐ
    const lowGate = { ...B, masteryGateBase: 5, masteryGateGrowth: 2 };
    expect(s.dmgByWeapon.pick).toBeGreaterThan(5);
    const r = prestige(s, lowGate);
    expect(r.perm.mastery.pick).toBe(1); // 閾値超え→+1
    expect(r.perm.mastery.beam).toBe(0); // 使っていない武器は0のまま
    // 閾値が高すぎると（=その走行ではそこまでダメージを出していない）増えない＝転生連打で伸ばし放題にならない。
    const r2 = prestige(s, { ...B, masteryGateBase: 1e9 });
    expect(r2.perm.mastery.pick).toBe(0);
  });

  it('★は走行中に獲得予定が貯まり、転生でもらえる', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.runPoints).toBeGreaterThan(0); // 走行中は獲得予定★が貯まる
    expect(s.points).toBe(0);               // ★本体は転生まで増えない
    const r = prestige(s, B);
    expect(r.points).toBe(s.points + s.runPoints); // 転生でまとめてもらえる
    expect(r.runPoints).toBe(0);                    // リセット
  });
});
