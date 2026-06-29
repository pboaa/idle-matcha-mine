import { describe, it, expect } from 'vitest';
import { weaponSkillNodes, weaponStatApplies, WEAPON_STATS, SKILL_GRID, WEAPON_STAT_DEFS, type WeaponStat } from '@domain/mining/skilltree';
import { WEAPON_IDS } from '@domain/mining/balance';

describe('mining/skilltree', () => {
  it('全武器: SKILL_GRID×SKILL_GRID のグリッド・中央が起点(root)・決定的', () => {
    const c = (SKILL_GRID - 1) / 2;
    for (const w of WEAPON_IDS) {
      const n = weaponSkillNodes(w);
      expect(n.length).toBe(SKILL_GRID * SKILL_GRID);             // グリッド全マス
      expect(weaponSkillNodes(w)).toBe(n);                        // メモ化＝同一参照（決定的）
      expect(n.every((x) => WEAPON_STATS.includes(x.stat))).toBe(true);
      const roots = n.filter((x) => x.root);
      expect(roots.length).toBe(1);                              // 起点は中央1つ
      expect(roots[0]!.x === c && roots[0]!.y === c).toBe(true);
      expect(new Set(n.map((x) => x.tier)).size).toBe((SKILL_GRID + 1) / 2); // リング(=階層)が中央から外へ
    }
  });

  it('ツルハシ: 中央の左右が範囲(area)・土で安い（サクサクで3方向化）', () => {
    const c = (SKILL_GRID - 1) / 2;
    const nodes = weaponSkillNodes('pick');
    const lr = nodes.filter((n) => n.y === c && (n.x === c - 1 || n.x === c + 1));
    expect(lr.length).toBe(2);
    expect(lr.every((n) => n.stat === 'area' && n.matId === 'dirt' && n.matCost <= 50)).toBe(true); // 安い
  });

  it('その他の武器: 範囲/射程/貫通は外側リング(終盤)に出る', () => {
    for (const w of WEAPON_IDS) {
      if (w === 'pick') continue;
      const specials = weaponSkillNodes(w).filter((n) => n.stat === 'range' || n.stat === 'area' || n.stat === 'pierce');
      expect(specials.length).toBeGreaterThanOrEqual(4);
      expect(specials.every((n) => n.tier >= 2)).toBe(true); // 外側リング＝終盤のみ
    }
  });

  it('ビーム: 範囲(area)は最大方向数(8本=spread6)に届く数だけある', () => {
    const beamArea = weaponSkillNodes('beam').filter((n) => n.stat === 'area').length;
    expect(beamArea).toBeGreaterThanOrEqual(6); // spread6 で 8方向
  });

  it('外側リングほど高コスト（終盤ほど上げにくい）', () => {
    const nodes = weaponSkillNodes('bullet');
    const fillerCost = (t: number): number => nodes.find((n) => n.tier === t && !n.big)!.matCost;
    expect(fillerCost(4)).toBeGreaterThan(fillerCost(0)); // 外ほど量が多い
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
