/**
 * お宝図鑑（全100種・個数制コレクション）。最後のやり込み要素。
 * - お宝は「武器ごと」に属する。その武器を持ち込んだ周回(=装備中)でのみドロップ（壊した武器は不問）。
 *   → 色んな武器を持ち込む理由になる。つるはしはメイン（常時装備）。
 * - 効果は「武器個別強化(self=その武器のダメージ)」と「全体強化(global)」の両方。
 * - レアリティ5段階（コモン〜伝説）。レアほど深く解禁＆超低確率＆効果大。
 * - 何個でも重複入手でき、重なるほど効果は √(個数) で逓減（インフレ防止）。
 */
import { WEAPON_DEFS, WEAPON_IDS, type WeaponId } from '@domain/mining/balance';

export type TreasureRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type TreasureEffect = 'power' | 'coin' | 'mine' | 'crit' | 'haste' | 'xp' | 'drop';
export type TreasureScope = 'self' | 'global'; // self=その武器のダメージ／global=全体効果

export interface TreasureDef {
  readonly id: number; readonly emoji: string; readonly name: string;
  readonly weapon: WeaponId; readonly rarity: TreasureRarity;
  readonly scope: TreasureScope; readonly effect: TreasureEffect | null; readonly amount: number;
}
export interface RarityDef {
  readonly id: TreasureRarity; readonly label: string; readonly color: string;
  readonly minFloor: number; readonly baseChance: number; readonly amountMul: number;
}

// レアリティ定義（レアほど深く解禁＆超低確率＆効果大）。種類数は配分テンプレから算出。
export const RARITY_DEFS: readonly RarityDef[] = [
  { id: 'common', label: 'コモン', color: '#9ca3af', minFloor: 0, baseChance: 0.02, amountMul: 1 },
  { id: 'uncommon', label: 'アンコモン', color: '#34d399', minFloor: 1, baseChance: 0.006, amountMul: 1.7 },
  { id: 'rare', label: 'レア', color: '#60a5fa', minFloor: 3, baseChance: 0.0014, amountMul: 2.8 },
  { id: 'epic', label: 'エピック', color: '#c084fc', minFloor: 6, baseChance: 0.0003, amountMul: 5 },
  { id: 'legendary', label: '伝説', color: '#fbbf24', minFloor: 10, baseChance: 0.00004, amountMul: 9 },
];
export const RARITY_BY_ID: Record<TreasureRarity, RarityDef> = Object.fromEntries(RARITY_DEFS.map((r) => [r.id, r])) as Record<TreasureRarity, RarityDef>;

const GLOBAL_EFFECTS: readonly TreasureEffect[] = ['power', 'coin', 'mine', 'crit', 'haste', 'xp', 'drop'];
export const TREASURE_EFFECT_LABEL: Record<TreasureEffect, { label: string; emoji: string }> = {
  power: { label: '火力', emoji: '🔥' }, coin: { label: '金運', emoji: '🪙' }, mine: { label: '採掘', emoji: '⛏️' },
  crit: { label: '会心', emoji: '✨' }, haste: { label: '俊敏', emoji: '🌀' }, xp: { label: '学び', emoji: '📖' },
  drop: { label: '発掘', emoji: '🔎' },
};
// 効果量（派手め）。実量＝基準×レアリティのamountMul。重複は √(個数) 逓減で歯止め。
const BASE_AMOUNT: Record<TreasureEffect, number> = { power: 0.03, coin: 0.04, mine: 0.025, crit: 0.006, haste: 0.02, xp: 0.04, drop: 0.04 };
const SELF_BASE = 0.12; // 武器個別ダメージの基準量（その武器がぐっと伸びる）
const EMOJI: Record<TreasureRarity, readonly string[]> = {
  common: ['🪨', '🔩', '🧭', '🕯️', '🍶', '🧱', '🪵', '🪟'],
  uncommon: ['🧪', '🔧', '🪙', '🧲', '🪔', '🗝️', '🎐', '🧴'],
  rare: ['💠', '🔱', '🏺', '📜', '🪬', '🧿', '⚗️', '🛡️'],
  epic: ['💎', '👑', '💍', '🔮', '⚜️', '🎖️'],
  legendary: ['🏆', '🌟', '🐉', '☄️', '🔥'],
};
// 武器ごとのレアリティ配分（つるはしは多め＝メイン・常時装備）。合計100。
const TEMPLATE: Record<'pick' | 'other', Record<TreasureRarity, number>> = {
  pick: { common: 7, uncommon: 4, rare: 3, epic: 1, legendary: 1 },     // 16
  other: { common: 6, uncommon: 4, rare: 2, epic: 1, legendary: 1 },    // 14 ×6 = 84
};

/** 全お宝の定義（武器→レアリティ順にid割当）。 */
export const TREASURE_DEFS: readonly TreasureDef[] = (() => {
  const out: TreasureDef[] = [];
  let id = 0;
  for (const w of WEAPON_IDS) {
    const tpl = w === 'pick' ? TEMPLATE.pick : TEMPLATE.other;
    let k = 0; // この武器内の通し番号（scope/効果/絵文字のローテーション用）
    for (const r of RARITY_DEFS) {
      for (let c = 0; c < tpl[r.id]; c++, k++, id++) {
        const scope: TreasureScope = k % 2 === 0 ? 'self' : 'global';
        const effect = scope === 'global' ? GLOBAL_EFFECTS[k % GLOBAL_EFFECTS.length]! : null;
        const amount = (scope === 'self' ? SELF_BASE : BASE_AMOUNT[effect!]) * r.amountMul;
        const wl = WEAPON_DEFS[w].label;
        const suffix = r.id === 'legendary' ? '神器' : r.id === 'epic' ? '秘宝' : r.id === 'rare' ? 'お宝' : r.id === 'uncommon' ? '逸品' : 'かけら';
        const name = scope === 'self' ? `${wl}の${suffix}（${wl}強化）` : `${TREASURE_EFFECT_LABEL[effect!].label}の${suffix}（${wl}持込）`;
        const emoji = scope === 'self' ? WEAPON_DEFS[w].emoji : EMOJI[r.id][k % EMOJI[r.id].length]!;
        out.push({ id, emoji, name, weapon: w, rarity: r.id, scope, effect, amount });
      }
    }
  }
  return out;
})();

export const TREASURE_TOTAL = TREASURE_DEFS.length; // 100
export const RARITY_COUNT: Record<TreasureRarity, number> = Object.fromEntries(
  RARITY_DEFS.map((r) => [r.id, TREASURE_DEFS.filter((d) => d.rarity === r.id).length]),
) as Record<TreasureRarity, number>;
/** レアリティ→そのレアリティのid配列（ドロップ抽選用）。 */
export const RARITY_IDS: Record<TreasureRarity, readonly number[]> = Object.fromEntries(
  RARITY_DEFS.map((r) => [r.id, TREASURE_DEFS.filter((d) => d.rarity === r.id).map((d) => d.id)]),
) as unknown as Record<TreasureRarity, readonly number[]>;
export const rarityOf = (id: number): TreasureRarity => TREASURE_DEFS[id]?.rarity ?? 'common';
export const weaponOf = (id: number): WeaponId => TREASURE_DEFS[id]?.weapon ?? 'pick';

/** お宝図鑑（id→個数）。 */
export type TreasureDex = Record<number, number>;
export const dexKinds = (dex: TreasureDex): number => Object.values(dex).filter((c) => c > 0).length;
export const dexTotalCount = (dex: TreasureDex): number => Object.values(dex).reduce((a, c) => a + c, 0);

/** 図鑑効果の合計。global=全体効果、perWeapon=武器個別ダメージ。重複は √(個数) で逓減。 */
export interface DexTotals { readonly global: Record<TreasureEffect, number>; readonly perWeapon: Record<WeaponId, number> }
export function dexEffectTotals(dex: TreasureDex): DexTotals {
  const global: Record<TreasureEffect, number> = { power: 0, coin: 0, mine: 0, crit: 0, haste: 0, xp: 0, drop: 0 };
  const perWeapon: Record<WeaponId, number> = Object.fromEntries(WEAPON_IDS.map((w) => [w, 0])) as Record<WeaponId, number>;
  for (const [idStr, count] of Object.entries(dex)) {
    if (count <= 0) continue;
    const d = TREASURE_DEFS[Number(idStr)];
    if (!d) continue;
    const v = d.amount * Math.sqrt(count);
    if (d.scope === 'self') perWeapon[d.weapon] += v;
    else if (d.effect) global[d.effect] += v;
  }
  return { global, perWeapon };
}
