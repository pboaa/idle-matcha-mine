import { describe, it, expect } from 'vitest';
import { weaponSkillNodes, weaponStatApplies, WEAPON_STATS, SKILL_TIERS, WEAPON_STAT_DEFS, type WeaponStat } from '@domain/mining/skilltree';
import { WEAPON_IDS } from '@domain/mining/balance';

describe('mining/skilltree', () => {
  it('全武器: SKILL_TIERS 段の階層・小さなノードが一杯・決定的', () => {
    for (const w of WEAPON_IDS) {
      const n = weaponSkillNodes(w);
      const tiers = new Set(n.map((x) => x.tier));
      expect(tiers.size).toBe(SKILL_TIERS);                       // 5階層
      expect(n.length).toBeGreaterThan(SKILL_TIERS * 3);          // ノードが一杯
      expect(weaponSkillNodes(w)).toBe(n);                        // メモ化＝同一参照（決定的）
      expect(n.every((x) => WEAPON_STATS.includes(x.stat))).toBe(true);
      expect(n.filter((x) => x.stat === 'damage' || x.stat === 'speed').length).toBeGreaterThanOrEqual(SKILL_TIERS); // filler(小ノード)が一杯
    }
  });

  it('ツルハシ: 範囲(area)は tier1×2・土で序盤に取れる（3方向化）', () => {
    const area = weaponSkillNodes('pick').filter((n) => n.stat === 'area');
    expect(area.length).toBe(2);
    expect(area.every((n) => n.tier === 1 && n.matId === 'dirt')).toBe(true);
    expect(area.every((n) => n.matCost >= 300 && n.matCost <= 800)).toBe(true);
  });

  it('その他の武器: 範囲/射程/貫通は終盤(tier3-4)に出る', () => {
    for (const w of WEAPON_IDS) {
      if (w === 'pick') continue;
      const specials = weaponSkillNodes(w).filter((n) => n.stat === 'range' || n.stat === 'area' || n.stat === 'pierce');
      expect(specials.length).toBeGreaterThan(0);
      expect(specials.every((n) => n.tier >= 3)).toBe(true); // 終盤のみ
    }
  });

  it('素材は階層が深いほど上位＆高コスト（質と量が上がる）', () => {
    const pick = weaponSkillNodes('pick');
    const fillerByTier = (t: number): number => pick.find((n) => n.tier === t && !n.big)!.matCost;
    expect(fillerByTier(4)).toBeGreaterThan(fillerByTier(0)); // 深い階層ほど量が多い
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
