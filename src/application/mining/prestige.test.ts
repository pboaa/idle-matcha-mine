import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyMaterials, emptyPerm } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { buyCoinUp, coinUpCost, buyWeaponSkill, skillNodeUnlockable, allowedWeapons, weaponUnlockStar, refine, prestige } from '@application/mining/prestige';
import { defaultMiningBalance, WEAPON_IDS, MATERIAL_IDS, BASE_WEAPONS, WEAPON_UNLOCK_ORDER, weaponSkillNodes } from '@domain/mining/balance';

const B = defaultMiningBalance;

describe('mining/prestige', () => {
  it('採掘で素材がたまる（コインと別資源）', () => {
    const s = stepMine(initialMineState(), 8000);
    const totalMat = MATERIAL_IDS.reduce((a, id) => a + s.materials[id], 0);
    expect(totalMat).toBeGreaterThan(0);
    expect(s.coins).toBeGreaterThan(0); // コインも別で増える
  });

  it('精錬: 8個の下位→1個の上位（土が腐らない）', () => {
    const s = { ...initialMineState(), materials: { ...emptyMaterials(), dirt: 20 } };
    const r = refine(s, 'dirt', B);
    expect(r.materials.dirt).toBe(20 - B.refineRatio);
    expect(r.materials.stone).toBe(1);
  });

  it('開始はツルハシのみ・恒久の開始レベルは持ち込まない（freshRun／持ち込みバグ防止）', () => {
    // perm(スキルツリーや熟練)を持っていても、走行開始の武器/強化レベルは増えない。
    const s = freshRun(B, emptyMaterials(), emptyPerm(), 0);
    expect(s.levels.pick).toBe(1);                         // 開始はツルハシLv1のみ
    expect(WEAPON_IDS.filter((w) => w !== 'pick').every((w) => s.levels[w] === 0)).toBe(true); // 他武器は0
    expect(s.meta.appraise).toBe(0);                       // 目利きも持ち込まない
  });

  it('序盤は武器2種のみ・累計★で自動解放される', () => {
    const s0 = initialMineState();
    expect([...allowedWeapons(s0.perm)]).toEqual([...BASE_WEAPONS]); // 最初(★0)は2種のみ
    const first = WEAPON_UNLOCK_ORDER[0]!;             // 最初に解放される武器
    const need = weaponUnlockStar(first);
    expect(allowedWeapons({ ...s0.perm, starEarned: need - 1 })).not.toContain(first); // 閾値未満は出ない
    expect(allowedWeapons({ ...s0.perm, starEarned: need })).toContain(first);         // 閾値で自動解放
    // 転生で runPoints が累計★(starEarned)に積まれ、達した武器が次走から出る
    const s = { ...stepMine(initialMineState(), 60_000) };
    const r = prestige({ ...s, runPoints: need }, B);
    expect(r.perm.starEarned).toBeGreaterThanOrEqual(need);
    expect(allowedWeapons(r.perm)).toContain(first);
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
    const dug = (s: ReturnType<typeof stepMine>): number => MATERIAL_IDS.reduce((a, id) => a + s.materials[id], 0);
    // 独立した新規state（stepMineはdugを破壊的更新するので使い回さない）。手動＋目標で同じ採掘量。
    const make = (greed: number) => ({ ...initialMineState(), autoMode: false, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 0, y: 0 } }, coinUp: { haste: 0, greed, luck: 0 } });
    const plain = dug(stepMine(make(0), 20_000));
    const greedy = dug(stepMine(make(30), 20_000));
    expect(greedy).toBeGreaterThan(plain); // 強欲で素材が増えやすい
  });


  it('武器スキルツリー(階層): 素材で解放・下の階層を埋めると次が解禁', () => {
    const nodes = weaponSkillNodes('pick');
    const tier0 = nodes.map((_, i) => i).filter((i) => nodes[i]!.tier === 0);
    const tier1plus = nodes.findIndex((n) => n.tier >= 1); // 上の階層のノード
    const rich = { ...emptyMaterials() };
    for (const id of MATERIAL_IDS) rich[id] = 99999; // 素材たっぷり
    const s0 = { ...initialMineState(), materials: rich };
    expect(skillNodeUnlockable('pick', [], tier0[0]!)).toBe(true);       // 起点(tier0)は解禁済み
    expect(skillNodeUnlockable('pick', [], tier1plus)).toBe(false);      // 下の階層が未達なので不可
    const n0 = nodes[tier0[0]!]!;
    const s1 = buyWeaponSkill(s0, 'pick', tier0[0]!);
    expect(s1.perm.weaponSkill.pick).toEqual([tier0[0]]);               // 起点解放
    expect(s1.materials[n0.matId]).toBe(99999 - n0.matCost);            // 素材消費
    // tier0 を tierUnlockCount だけ買うと tier1 が解禁される
    let s = s0;
    for (const i of tier0.slice(0, B.tierUnlockCount)) s = buyWeaponSkill(s, 'pick', i);
    expect(skillNodeUnlockable('pick', s.perm.weaponSkill.pick, tier1plus)).toBe(true);
    const poor = { ...initialMineState(), materials: emptyMaterials() };
    expect(buyWeaponSkill(poor, 'pick', tier0[0]!).perm.weaponSkill.pick).toEqual([]); // 素材不足で不可
  });

  it('武器スキルツリーはノードが多く・序盤に範囲ノード(土)・武器ごとに形が違う', () => {
    const pick = weaponSkillNodes('pick'); const beam = weaponSkillNodes('beam');
    expect(pick.length).toBeGreaterThan(8);                         // ノードがいっぱい
    expect(pick.filter((n) => n.stat === 'damage').length).toBeGreaterThanOrEqual(3); // +ダメージも複数ある
    // ツルハシ: tier1に範囲(area)ノードが2つ・どちらも土で序盤に取れる（3方向化）
    const area1 = pick.filter((n) => n.stat === 'area' && n.tier === 1);
    expect(area1.length).toBe(2);
    expect(area1.every((n) => n.matId === 'dirt' && n.matCost >= 300 && n.matCost <= 800)).toBe(true);
    expect(pick.map((n) => `${n.x},${n.y}`).join('|')).not.toBe(beam.map((n) => `${n.x},${n.y}`).join('|')); // 形が違う
  });

  it('転生: 走行リセット・鉱石/累計★/回数は保持', () => {
    const s = stepMine(initialMineState(), 30_000);
    const r = prestige(s, B);
    expect(r.floor).toBe(0);
    expect(r.level).toBe(1);
    expect(r.materials).toEqual(s.materials); // 鉱石は永続保存（変換しない）
    expect(r.perm.starEarned).toBe(s.perm.starEarned + s.runPoints); // 累計★に走行分を加算
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

  it('★は走行中に獲得予定(runPoints)が貯まり、転生で累計★に積まれる（＝全体ダメージ自動UP）', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.runPoints).toBeGreaterThan(0);      // 走行中は獲得予定★が貯まる
    expect(s.perm.starEarned).toBe(0);           // 累計★は転生まで増えない
    const r = prestige(s, B);
    expect(r.perm.starEarned).toBe(s.runPoints); // 転生でまとめて積まれる
    expect(r.runPoints).toBe(0);                 // リセット
  });
});
