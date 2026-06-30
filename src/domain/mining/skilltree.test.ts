import { describe, it, expect } from 'vitest';
import { weaponSkillNodes, mainSkillNodes, weaponStatApplies, WEAPON_STATS, MAIN_STATS, SKILL_TIERS, SKILL_GRID_SIZES, skillGridCenter, WEAPON_STAT_DEFS, type WeaponStat } from '@domain/mining/skilltree';
import { WEAPON_IDS } from '@domain/mining/balance';

const totalCells = SKILL_GRID_SIZES.reduce((a, s) => a + s * s, 0);

describe('mining/skilltree', () => {
  it('全武器: 階層ごとに1グリッド（5グリッド・5x5〜10x10）・各グリッド中央が起点・決定的', () => {
    for (const w of WEAPON_IDS) {
      const n = weaponSkillNodes(w);
      expect(n.length).toBe(totalCells);                         // 5グリッドの全マス合計
      expect(weaponSkillNodes(w)).toBe(n);                       // メモ化＝同一参照（決定的）
      expect(n.every((x) => (WEAPON_STATS as readonly string[]).includes(x.stat))).toBe(true); // 武器ツリーは武器ステータスのみ
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

  it('特殊系は「1グリッドに約2個」だけ（インフレ防止）・残りはfiller。種類は巡回でバリエーション', () => {
    const beam = weaponSkillNodes('beam'); // 直線系＝貫通も範囲も射程も有効
    for (let grid = 1; grid < SKILL_TIERS; grid++) {
      const specials = beam.filter((n) => n.tier === grid && (n.stat === 'range' || n.stat === 'area' || n.stat === 'pierce' || n.stat === 'unique'));
      expect(specials.length).toBeLessThanOrEqual(2); // 1グリッド最大2個
    }
    for (const stat of ['range', 'area', 'pierce', 'unique'] as const) expect(beam.some((n) => n.stat === stat)).toBe(true); // 種類が一通りある
    expect(beam.filter((n) => n.stat === 'damage' || n.stat === 'speed').length).toBeGreaterThan(beam.length * 0.9); // 9割超がfiller
    // フィールド系(オーラ)は範囲/貫通は無効＝出ない、射程は出る。
    const aura = weaponSkillNodes('aura');
    expect(aura.some((n) => n.stat === 'area' || n.stat === 'pierce')).toBe(false);
    expect(aura.some((n) => n.stat === 'range')).toBe(true);
  });

  it('メインツリー: 全体強化のステータス（power/crit/coin等）で構成・武器ステータスは無い', () => {
    const main = mainSkillNodes();
    expect(main.length).toBe(totalCells);
    expect(main.every((n) => (MAIN_STATS as readonly string[]).includes(n.stat))).toBe(true); // 全体ステータスのみ
    for (const stat of ['power', 'crit', 'coin'] as const) expect(main.some((n) => n.stat === stat)).toBe(true);
    expect(main.filter((n) => n.stat === 'power' || n.stat === 'mine' || n.stat === 'haste').length).toBeGreaterThan(main.length * 0.8); // 大半がfiller(火力/採掘/速度)
  });

  it('★コスト: 全ノードに正の★コスト・深い階層/外周ほど高い', () => {
    const nodes = weaponSkillNodes('bullet');
    expect(nodes.every((n) => n.starCost >= 1)).toBe(true);             // 1ノード＝正の★コスト
    const root = (t: number): typeof nodes[number] => nodes.find((n) => n.tier === t && n.root)!;
    expect(root(4).starCost).toBeGreaterThan(root(0).starCost);         // 深い階層ほど高い
    const costs = new Set(nodes.map((n) => n.starCost));
    expect(costs.size).toBeGreaterThanOrEqual(3);                       // 位置で段階的にコストが変わる
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
