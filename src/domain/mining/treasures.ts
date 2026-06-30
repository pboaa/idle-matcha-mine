/**
 * お宝図鑑（全100種コレクション）。集めると永続ボーナス（効果の合計）。
 * - ノーマル（51種）: 普段の採掘でランダムに入手。
 * - レア（49種・7x7の「★グリッド」）: 転生ポイント★を使ってグリッドのマスを開けて入手。
 * 旧・恒久スキルツリーの置き換え。永続の強さは「図鑑効果＋累計★倍率」から。
 */

export type TreasureRarity = 'normal' | 'rare';
export type TreasureEffect = 'power' | 'coin' | 'mine' | 'crit' | 'haste' | 'xp';

export interface TreasureDef {
  readonly id: number; readonly emoji: string; readonly name: string;
  readonly rarity: TreasureRarity; readonly effect: TreasureEffect; readonly amount: number;
}
/** レアお宝は ★グリッド のマス（中央から隣接で開く）。 */
export interface StarNode {
  readonly id: number; // = TreasureDef.id（レア）
  readonly x: number; readonly y: number; readonly ring: number;
  readonly starCost: number; readonly root: boolean; readonly requires: readonly number[];
}

export const STAR_GRID_SIZE = 7;              // ★グリッド 7x7 = 49マス＝レア49種
export const RARE_COUNT = STAR_GRID_SIZE * STAR_GRID_SIZE; // 49
export const NORMAL_COUNT = 51;
export const TREASURE_TOTAL = RARE_COUNT + NORMAL_COUNT;   // 100

const EFFECTS: readonly TreasureEffect[] = ['power', 'coin', 'mine', 'crit', 'haste', 'xp'];
export const TREASURE_EFFECT_LABEL: Record<TreasureEffect, { label: string; emoji: string }> = {
  power: { label: '火力', emoji: '🔥' }, coin: { label: '金運', emoji: '🪙' }, mine: { label: '採掘', emoji: '⛏️' },
  crit: { label: '会心', emoji: '✨' }, haste: { label: '俊敏', emoji: '🌀' }, xp: { label: '学び', emoji: '📖' },
};
// 効果1ノードあたりの量（クリックで覚える感覚の小さめの値・rareは大きめ）。crit は確率なので控えめ。
const AMOUNT: Record<TreasureRarity, Record<TreasureEffect, number>> = {
  normal: { power: 0.02, coin: 0.03, mine: 0.02, crit: 0.004, haste: 0.015, xp: 0.03 },
  rare: { power: 0.05, coin: 0.07, mine: 0.05, crit: 0.01, haste: 0.04, xp: 0.07 },
};
const RARE_EMOJI = ['💎', '🏆', '👑', '💍', '🔮', '⚜️', '🎖️', '🗿', '⚱️', '🪅'];
const NORMAL_EMOJI = ['🪨', '🔩', '🧭', '🕯️', '🍶', '🧱', '🪵', '🪟', '🔋', '📿'];

const idxAt = (x: number, y: number): number => y * STAR_GRID_SIZE + x;
const neighbors = (x: number, y: number): number[] =>
  ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const)
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < STAR_GRID_SIZE && ny < STAR_GRID_SIZE)
    .map(([nx, ny]) => idxAt(nx, ny));

const CEN = Math.floor((STAR_GRID_SIZE - 1) / 2);

/** ★グリッド（レアお宝）のノード一覧。id=0..48。中央が起点・★コストはリングで上昇。 */
export const STAR_NODES: readonly StarNode[] = (() => {
  const out: StarNode[] = [];
  for (let y = 0; y < STAR_GRID_SIZE; y++) for (let x = 0; x < STAR_GRID_SIZE; x++) {
    const id = idxAt(x, y);
    const ring = Math.max(Math.abs(x - CEN), Math.abs(y - CEN));
    out.push({ id, x, y, ring, root: ring === 0, starCost: Math.max(1, Math.round(2 * Math.pow(1.6, ring))), requires: neighbors(x, y) });
  }
  return out;
})();

/** 全お宝の定義（0..48=レア／49..99=ノーマル）。 */
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

/** 集めた図鑑(idの配列)の効果合計。 */
export function dexEffectTotals(dex: readonly number[]): Record<TreasureEffect, number> {
  const out: Record<TreasureEffect, number> = { power: 0, coin: 0, mine: 0, crit: 0, haste: 0, xp: 0 };
  for (const id of dex) { const d = TREASURE_DEFS[id]; if (d) out[d.effect] += d.amount; }
  return out;
}

/** ★グリッドのそのレアマスが今開けられるか（未収集・中央or隣接が収集済み）。collected=収集済みid集合。 */
export function starNodeUnlockable(collected: ReadonlySet<number>, id: number): boolean {
  const n = STAR_NODES[id]; if (!n || collected.has(id)) return false;
  return n.root || n.requires.some((r) => collected.has(r));
}
