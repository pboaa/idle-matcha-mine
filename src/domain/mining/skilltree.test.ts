import { describe, it, expect } from 'vitest';
import { weaponSkillNodes, weaponStatApplies, WEAPON_STATS, SKILL_TIERS, SKILL_GRID_SIZES, skillGridCenter, WEAPON_STAT_DEFS, type WeaponStat } from '@domain/mining/skilltree';
import { WEAPON_IDS } from '@domain/mining/balance';

const totalCells = SKILL_GRID_SIZES.reduce((a, s) => a + s * s, 0);

describe('mining/skilltree', () => {
  it('全武器: 階層ごとに1グリッド（5グリッド・5x5〜10x10）・各グリッド中央が起点・決定的', () => {
    for (const w of WEAPON_IDS) {
      const n = weaponSkillNodes(w);
      expect(n.length).toBe(totalCells);                         // 5グリッドの全マス合計
      expect(weaponSkillNodes(w)).toBe(n);                       // メモ化＝同一参照（決定的）
      expect(n.every((x) => WEAPON_STATS.includes(x.stat))).toBe(true);
      expect(new Set(n.map((x) => x.tier)).size).toBe(SKILL_TIERS); // 5階層
      // 各階層に中央起点(root)が1つ
      for (let t = 0; t < SKILL_TIERS; t++) {
        const roots = n.filter((x) => x.tier === t && x.root);
        expect(roots.length).toBe(1);
        const c = skillGridCenter(t);
        expect(roots[0]!.x === c && roots[0]!.y === c).toBe(true);
      }
    }
  });

  it('ツルハシ: 階層1(最小グリッド)中央の左右が範囲(area)・土で安い（サクサクで3方向化）', () => {
    const c = skillGridCenter(0);
    const lr = weaponSkillNodes('pick').filter((n) => n.tier === 0 && n.y === c && (n.x === c - 1 || n.x === c + 1));
    expect(lr.length).toBe(2);
    expect(lr.every((n) => n.stat === 'area' && n.matCosts.length === 1 && n.matCosts[0]!.matId === 'dirt' && n.matCosts[0]!.amount <= 50)).toBe(true); // 安い
  });

  it('グリッドに貫通/範囲/射程/固有が織り交ぜられている（武器ごとに有効なもの）', () => {
    const beam = weaponSkillNodes('beam'); // 直線系＝貫通も範囲も射程も有効
    for (const stat of ['range', 'area', 'pierce', 'unique'] as const) expect(beam.some((n) => n.stat === stat)).toBe(true);
    expect(beam.filter((n) => n.stat === 'damage' || n.stat === 'speed').length).toBeGreaterThan(beam.length / 2); // fillerが過半（特殊はまばら）
    // フィールド系(オーラ)は範囲(area)/貫通(pierce)は無効＝出ない、射程(range)はある。
    const aura = weaponSkillNodes('aura');
    expect(aura.some((n) => n.stat === 'area')).toBe(false);
    expect(aura.some((n) => n.stat === 'pierce')).toBe(false);
    expect(aura.some((n) => n.stat === 'range')).toBe(true);
  });

  it('深い階層ほど高コスト＆「色んな素材」を要求（種類が増える・量も増える）', () => {
    const nodes = weaponSkillNodes('bullet');
    const root = (t: number): typeof nodes[number] => nodes.find((n) => n.tier === t && n.root)!;
    const total = (t: number): number => root(t).matCosts.reduce((a, c) => a + c.amount, 0);
    expect(total(4)).toBeGreaterThan(total(0));                          // 深い階層ほど量が多い
    expect(root(4).matCosts.length).toBeGreaterThan(root(0).matCosts.length); // 深い階層ほど素材の種類が増える
    expect(root(0).matCosts.length).toBe(1);                            // 階層1中央は1種（安い）
  });

  it('weaponStatApplies: 貫通=直線系のみ／範囲=フィールド系以外', () => {
    expect(weaponStatApplies('pierce', 'beam')).toBe(true);   // 直線
    expect(weaponStatApplies('pierce', 'pick')).toBe(false);  // 非直線
    expect(weaponStatApplies('area', 'aura')).toBe(false);    // フィールドは範囲不可（半径=射程）
    expect(weaponStatApplies('area', 'bullet')).toBe(true);
  });

  it('WEAPON_STAT_DEFS は全ステータスを定義', () => {
    for (const s of WEAPON_STATS) expect(WEAPON_STAT_DEFS[s as WeaponStat].label.length).toBeGreaterThan(0);
  });
});
