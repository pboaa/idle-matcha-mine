/**
 * お宝図鑑（全100種・個数制コレクション）。最後のやり込み要素。
 * - 採掘中にランダムドロップ。レアリティ5段階（コモン〜伝説）。レアリティごとに
 *   「解禁階(minFloor)」と「ドロップ率(baseChance)」が違う＝レアほど深く＆超低確率。
 * - 何個でも重複入手でき、重なるほど効果は √(個数) で逓減（インフレ防止）。効果は多様。
 */

export type TreasureRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type TreasureEffect = 'power' | 'coin' | 'mine' | 'crit' | 'haste' | 'xp' | 'drop';

export interface TreasureDef {
  readonly id: number; readonly emoji: string; readonly name: string;
  readonly rarity: TreasureRarity; readonly effect: TreasureEffect; readonly amount: number;
}
export interface RarityDef {
  readonly id: TreasureRarity; readonly label: string; readonly color: string;
  readonly count: number; readonly minFloor: number; readonly baseChance: number; readonly amountMul: number;
}

// レアリティ定義（レアほど深く解禁＆超低確率＆効果大）。count の合計＝100。
export const RARITY_DEFS: readonly RarityDef[] = [
  { id: 'common', label: 'コモン', color: '#9ca3af', count: 40, minFloor: 0, baseChance: 0.02, amountMul: 1 },
  { id: 'uncommon', label: 'アンコモン', color: '#34d399', count: 28, minFloor: 1, baseChance: 0.006, amountMul: 1.7 },
  { id: 'rare', label: 'レア', color: '#60a5fa', count: 18, minFloor: 3, baseChance: 0.0014, amountMul: 2.8 },
  { id: 'epic', label: 'エピック', color: '#c084fc', count: 9, minFloor: 6, baseChance: 0.0003, amountMul: 5 },
  { id: 'legendary', label: '伝説', color: '#fbbf24', count: 5, minFloor: 10, baseChance: 0.00004, amountMul: 9 },
];
export const RARITY_BY_ID: Record<TreasureRarity, RarityDef> = Object.fromEntries(RARITY_DEFS.map((r) => [r.id, r])) as Record<TreasureRarity, RarityDef>;
export const TREASURE_TOTAL = RARITY_DEFS.reduce((a, r) => a + r.count, 0); // 100

const EFFECTS: readonly TreasureEffect[] = ['power', 'coin', 'mine', 'crit', 'haste', 'xp', 'drop'];
export const TREASURE_EFFECT_LABEL: Record<TreasureEffect, { label: string; emoji: string }> = {
  power: { label: '火力', emoji: '🔥' }, coin: { label: '金運', emoji: '🪙' }, mine: { label: '採掘', emoji: '⛏️' },
  crit: { label: '会心', emoji: '✨' }, haste: { label: '俊敏', emoji: '🌀' }, xp: { label: '学び', emoji: '📖' },
  drop: { label: '発掘', emoji: '🔎' },
};
// 効果ごとの基準量（小さめ＝√逓減と合わせてインフレ抑制）。実量＝基準×レアリティのamountMul。
const BASE_AMOUNT: Record<TreasureEffect, number> = { power: 0.012, coin: 0.018, mine: 0.012, crit: 0.0025, haste: 0.008, xp: 0.018, drop: 0.02 };
const EMOJI: Record<TreasureRarity, readonly string[]> = {
  common: ['🪨', '🔩', '🧭', '🕯️', '🍶', '🧱', '🪵', '🪟', '🔋', '📿'],
  uncommon: ['🧪', '🔧', '🪙', '🧲', '🪔', '🗝️', '🎐', '🧴', '🪜', '🧰'],
  rare: ['💠', '🔱', '🏺', '📜', '🪬', '🧿', '⚗️', '🎏', '🪩', '🛡️'],
  epic: ['💎', '👑', '💍', '🔮', '⚜️', '🎖️', '🗿', '⚱️', '🪅'],
  legendary: ['🏆', '🌟', '🐉', '☄️', '🔥'],
};

/** 全お宝の定義（レアリティ順にid割当: common→…→legendary）。 */
export const TREASURE_DEFS: readonly TreasureDef[] = (() => {
  const out: TreasureDef[] = [];
  let id = 0;
  for (const r of RARITY_DEFS) {
    for (let k = 0; k < r.count; k++) {
      const effect = EFFECTS[k % EFFECTS.length]!;
      const suffix = r.id === 'legendary' ? '神器' : r.id === 'epic' ? '秘宝' : r.id === 'rare' ? 'お宝' : r.id === 'uncommon' ? '逸品' : 'かけら';
      out.push({ id, emoji: EMOJI[r.id][k % EMOJI[r.id].length]!, name: `${TREASURE_EFFECT_LABEL[effect].label}の${suffix}`, rarity: r.id, effect, amount: BASE_AMOUNT[effect] * r.amountMul });
      id++;
    }
  }
  return out;
})();

/** id→所属レアリティのid配列（ドロップ抽選用）。 */
export const RARITY_IDS: Record<TreasureRarity, readonly number[]> = Object.fromEntries(
  RARITY_DEFS.map((r) => [r.id, TREASURE_DEFS.filter((d) => d.rarity === r.id).map((d) => d.id)]),
) as unknown as Record<TreasureRarity, readonly number[]>;
export const rarityOf = (id: number): TreasureRarity => TREASURE_DEFS[id]?.rarity ?? 'common';

/** お宝図鑑（id→個数）。 */
export type TreasureDex = Record<number, number>;
export const dexKinds = (dex: TreasureDex): number => Object.values(dex).filter((c) => c > 0).length;
export const dexTotalCount = (dex: TreasureDex): number => Object.values(dex).reduce((a, c) => a + c, 0);

/** 図鑑の効果合計。重複は √(個数) で逓減（重なるほど1個あたり弱まる＝壊れない）。 */
export function dexEffectTotals(dex: TreasureDex): Record<TreasureEffect, number> {
  const out: Record<TreasureEffect, number> = { power: 0, coin: 0, mine: 0, crit: 0, haste: 0, xp: 0, drop: 0 };
  for (const [idStr, count] of Object.entries(dex)) {
    if (count <= 0) continue;
    const d = TREASURE_DEFS[Number(idStr)];
    if (d) out[d.effect] += d.amount * Math.sqrt(count);
  }
  return out;
}
