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

  it('ツルハシ: 範囲(area)は tier1に2つ・土で序盤に取れる（3方向化）＋以降ゆっくり', () => {
    const area = weaponSkillNodes('pick').filter((n) => n.stat === 'area');
    const tier1 = area.filter((n) => n.tier === 1);
    expect(tier1.length).toBe(2);                                           // 序盤の3方向ぶん
    expect(tier1.every((n) => n.matId === 'dirt' && n.matCost >= 300 && n.matCost <= 800)).toBe(true);
    expect(area.length).toBeGreaterThan(2);                                 // その後も少しずつ増える
  });

  it('その他の武器: 範囲/射程/貫通は「少しずつ終盤まで」増える（複数ノードを中盤以降に厚く）', () => {
    for (const w of WEAPON_IDS) {
      if (w === 'pick') continue;
      const specials = weaponSkillNodes(w).filter((n) => n.stat === 'range' || n.stat === 'area' || n.stat === 'pierce');
      expect(specials.length).toBeGreaterThanOrEqual(4);              // 多数の+1ノード＝少しずつ
      expect(specials.every((n) => n.tier >= 2)).toBe(true);         // 中盤以降のみ（序盤は無し）
      expect(specials.some((n) => n.tier === SKILL_TIERS - 1)).toBe(true); // 最終段にもある＝終盤まで上がる
    }
  });

  it('ビーム: 範囲(area)は最大方向数(8本=spread6)に届く数だけある', () => {
    const beamArea = weaponSkillNodes('beam').filter((n) => n.stat === 'area').length;
    expect(beamArea).toBeGreaterThanOrEqual(6); // spread6 で 8方向
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
