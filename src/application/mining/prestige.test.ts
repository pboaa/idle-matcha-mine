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


  it('武器スキルツリー(階層グリッド): 各階層は中央起点・隣接で解放・次の階層は別グリッドで解禁制', () => {
    const nodes = weaponSkillNodes('pick');
    const rootIdx = nodes.findIndex((n) => n.root);                 // 階層1の中央
    const tier1Root = nodes.findIndex((n) => n.root && n.tier === 1); // 階層2の中央
    const rich = { ...emptyMaterials() };
    for (const id of MATERIAL_IDS) rich[id] = 9_999_999; // 素材たっぷり
    const s0 = { ...initialMineState(), materials: rich };
    expect(skillNodeUnlockable('pick', [], rootIdx)).toBe(true);        // 階層1中央は最初から解放可
    expect(skillNodeUnlockable('pick', [], tier1Root)).toBe(false);     // 階層2はまだ解禁されていない
    const root = nodes[rootIdx]!;
    const s1 = buyWeaponSkill(s0, 'pick', rootIdx);
    expect(s1.perm.weaponSkill.pick).toEqual([rootIdx]);              // 階層1中央を解放
    for (const c of root.matCosts) expect(s1.materials[c.matId]).toBe(9_999_999 - c.amount); // 必要素材を全て消費
    const neighbor = root.requires[0]!;
    expect(skillNodeUnlockable('pick', s1.perm.weaponSkill.pick, neighbor)).toBe(true); // 隣接が解禁
    const poor = { ...initialMineState(), materials: emptyMaterials() };
    expect(buyWeaponSkill(poor, 'pick', rootIdx).perm.weaponSkill.pick).toEqual([]); // 素材不足で不可
  });

  it('ツルハシ: 中央左右の範囲ノードが安い土・武器ごとに形が違う', () => {
    const pick = weaponSkillNodes('pick'); const beam = weaponSkillNodes('beam');
    const lr = pick.filter((n) => n.stat === 'area');
    expect(lr.length).toBeGreaterThanOrEqual(2);                    // 範囲ノード（左右）
    expect(lr.some((n) => n.matCosts.length === 1 && n.matCosts[0]!.matId === 'dirt' && n.matCosts[0]!.amount <= 50)).toBe(true); // 安い土＝サクサク3方向
    expect(pick.map((n) => `${n.stat}`).join('|')).not.toBe(beam.map((n) => `${n.stat}`).join('|')); // 形が違う
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
