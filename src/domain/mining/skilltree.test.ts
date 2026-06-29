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
    expect(lr.every((n) => n.stat === 'area' && n.matId === 'dirt' && n.matCost <= 50)).toBe(true); // 安い
  });

  it('その他の武器: 範囲/射程/貫通は深い階層(終盤)に分散して出る', () => {
    for (const w of WEAPON_IDS) {
      if (w === 'pick') continue;
      const specials = weaponSkillNodes(w).filter((n) => n.stat === 'range' || n.stat === 'area' || n.stat === 'pierce');
      expect(specials.length).toBeGreaterThanOrEqual(4);
      expect(specials.every((n) => n.tier >= 1)).toBe(true);                 // 階層2以降
      expect(specials.some((n) => n.tier === SKILL_TIERS - 1)).toBe(true);   // 最終階層にもある＝終盤まで
    }
  });

  it('ビーム: 範囲(area)は最大方向数(8本=spread6)に届く数だけある', () => {
    const beamArea = weaponSkillNodes('beam').filter((n) => n.stat === 'area').length;
    expect(beamArea).toBeGreaterThanOrEqual(6); // spread6 で 8方向
  });

  it('深い階層ほど高コスト＆上位素材（終盤ほど上げにくい）', () => {
    const nodes = weaponSkillNodes('bullet');
    const rootCost = (t: number): number => nodes.find((n) => n.tier === t && n.root)!.matCost;
    expect(rootCost(4)).toBeGreaterThan(rootCost(0)); // 深い階層ほど高い
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
