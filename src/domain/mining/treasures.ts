/**
 * お宝図鑑（全100種・個数制コレクション）。最後のやり込み要素。
 * - 採掘中にランダムドロップ（低確率）。何個でも重複入手できる。
 * - レアは「遠く/深く」に埋まっている＝拠点から遠いタイル・深い階ほどレア確率が上がる（序盤は近く＝ノーマル中心）。
 * - 重なるほど効果は弱まる（√で逓減＝インフレしすぎない）。効果は多様（火力/金運/採掘/会心/俊敏/学び/発掘）。
 */

export type TreasureRarity = 'normal' | 'rare';
export type TreasureEffect = 'power' | 'coin' | 'mine' | 'crit' | 'haste' | 'xp' | 'drop';

export interface TreasureDef {
  readonly id: number; readonly emoji: string; readonly name: string;
  readonly rarity: TreasureRarity; readonly effect: TreasureEffect; readonly amount: number;
}

export const RARE_COUNT = 30;
export const NORMAL_COUNT = 70;
export const TREASURE_TOTAL = RARE_COUNT + NORMAL_COUNT; // 100

const EFFECTS: readonly TreasureEffect[] = ['power', 'coin', 'mine', 'crit', 'haste', 'xp', 'drop'];
export const TREASURE_EFFECT_LABEL: Record<TreasureEffect, { label: string; emoji: string }> = {
  power: { label: '火力', emoji: '🔥' }, coin: { label: '金運', emoji: '🪙' }, mine: { label: '採掘', emoji: '⛏️' },
  crit: { label: '会心', emoji: '✨' }, haste: { label: '俊敏', emoji: '🌀' }, xp: { label: '学び', emoji: '📖' },
  drop: { label: '発掘', emoji: '🔎' },
};
// 1ノードあたりの量（小さめ＝√逓減と合わせてインフレ抑制）。crit は確率なので控えめ。
const AMOUNT: Record<TreasureRarity, Record<TreasureEffect, number>> = {
  normal: { power: 0.012, coin: 0.018, mine: 0.012, crit: 0.0025, haste: 0.008, xp: 0.018, drop: 0.02 },
  rare: { power: 0.03, coin: 0.045, mine: 0.03, crit: 0.006, haste: 0.02, xp: 0.045, drop: 0.05 },
};
const RARE_EMOJI = ['💎', '🏆', '👑', '💍', '🔮', '⚜️', '🎖️', '🗿', '⚱️', '🪅'];
const NORMAL_EMOJI = ['🪨', '🔩', '🧭', '🕯️', '🍶', '🧱', '🪵', '🪟', '🔋', '📿'];

/** 全お宝の定義（0..29=レア／30..99=ノーマル）。 */
export const TREASURE_DEFS: readonly TreasureDef[] = (() => {
  const out: TreasureDef[] = [];
  for (let i = 0; i < RARE_COUNT; i++) {
    const effect = EFFECTS[i % EFFECTS.length]!;
    out.push({ id: i, emoji: RARE_EMOJI[i % RARE_EMOJI.length]!, name: `${TREASURE_EFFECT_LABEL[effect].label}の秘宝`, rarity: 'rare', effect, amount: AMOUNT.rare[effect] });
  }
  for (let j = 0; j < NORMAL_COUNT; j++) {
    const id = RARE_COUNT + j;
    const effect = EFFECTS[j % EFFECTS.length]!;
    out.push({ id, emoji: NORMAL_EMOJI[j % NORMAL_EMOJI.length]!, name: `${TREASURE_EFFECT_LABEL[effect].label}のかけら`, rarity: 'normal', effect, amount: AMOUNT.normal[effect] });
  }
  return out;
})();

export const RARE_IDS: readonly number[] = TREASURE_DEFS.filter((t) => t.rarity === 'rare').map((t) => t.id);
export const NORMAL_IDS: readonly number[] = TREASURE_DEFS.filter((t) => t.rarity === 'normal').map((t) => t.id);
export const isRare = (id: number): boolean => id < RARE_COUNT;

/** お宝図鑑（id→個数）。 */
export type TreasureDex = Record<number, number>;
/** 集めた種類数（個数1以上）。 */
export const dexKinds = (dex: TreasureDex): number => Object.values(dex).filter((c) => c > 0).length;
/** 総個数。 */
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
