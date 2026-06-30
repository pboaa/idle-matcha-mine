import type { WeaponDef, WeaponId, WeaponTag, PassiveEffect, PassiveId } from '@domain/mining/balance';
import { PASSIVE_DEFS, PASSIVE_IDS, WEAPON_IDS } from '@domain/mining/balance';

/** 効果合計＋武器固有(perWeapon)のダメージ倍率を保持。 */
export type EffectTotals = Record<PassiveEffect, number> & { perWeapon: Record<WeaponId, number> };

/** 強化(特殊能力)の合計効果。走行グリッドで解放したバフ数(passive毎)を渡す。種別ごとに合算し、武器固有は perWeapon に。 */
export function passiveTotals(levels: Partial<Record<PassiveId, number>>): EffectTotals {
  const t: EffectTotals = {
    power: 0, rate: 0, move: 0, coin: 0, xp: 0, range: 0, pierce: 0, crit: 0,
    meleeDmg: 0, shotDmg: 0, beamDmg: 0, fieldDmg: 0, weaponDmg: 0,
    perWeapon: Object.fromEntries(WEAPON_IDS.map((w) => [w, 0])) as Record<WeaponId, number>,
  };
  for (const id of PASSIVE_IDS) {
    const d = PASSIVE_DEFS[id];
    const v = d.perLvl * (levels[id] ?? 0);
    if (v === 0) continue;
    if (d.targetWeapon) t.perWeapon[d.targetWeapon] += v; // 武器固有ユニーク
    else t[d.effect] += v;
  }
  return t;
}

/** 武器1段あたりの素ダメージ/秒（レベルで乗算）。 */
export const weaponDmg = (def: WeaponDef, level: number): number => def.baseDmg * (1 + def.dmgPerLvl * (level - 1));
/** 武器の射程/半径（レベル＋射程パッシブで伸びる）。 */
export const weaponRange = (def: WeaponDef, level: number, rangeBonus: number): number =>
  def.rangeBase + Math.floor((level - 1) / def.rangePerLvls) + rangeBonus;

const TAG_EFFECT: Record<WeaponTag, PassiveEffect> = { melee: 'meleeDmg', shot: 'shotDmg', beam: 'beamDmg', field: 'fieldDmg' };
/** 威力(全体)＋系統シナジー＋武器固有ユニークの倍率。 */
export const weaponMult = (def: WeaponDef, t: EffectTotals): number =>
  (1 + t.power) * (1 + t[TAG_EFFECT[def.tag]]) * (1 + t.perWeapon[def.id]);
