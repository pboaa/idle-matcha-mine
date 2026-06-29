/**
 * 武器ごとの恒久スキルツリーのマスターデータ＆生成（強化／ツリーをカタログから分離）。
 * 上→下に SKILL_TIERS 段の階層ツリー。各階層を一定数解放すると次が解禁。小さなノードが一杯。
 * balance.ts から分離して単体テストしやすくする（balance は本モジュールを再エクスポート）。
 */
import { WEAPON_DEFS, WEAPON_IDS, MATERIAL_IDS, type WeaponId, type MaterialId } from '@domain/mining/balance';

// ===== 武器ステータス（ツリーで伸ばす） =====
export type WeaponStat = 'damage' | 'speed' | 'range' | 'pierce' | 'area' | 'unique';
export const WEAPON_STATS: readonly WeaponStat[] = ['damage', 'speed', 'range', 'pierce', 'area', 'unique'];
export interface WeaponStatDef {
  readonly id: WeaponStat; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly lineOnly?: boolean;     // 貫通は直線(ビーム/ドリル)系だけ有効
  readonly notField?: boolean;     // 範囲(同時対象/横幅/方向)はフィールド系(オーラ/リング)には無効=半径は射程で
}
export const WEAPON_STAT_DEFS: Record<WeaponStat, WeaponStatDef> = {
  damage: { id: 'damage', label: 'ダメージ', emoji: '⚔️', desc: 'この武器のダメージ +5%/ノード' },
  speed: { id: 'speed', label: '攻撃速度', emoji: '⏱️', desc: 'この武器の攻撃が速くなる +5%/ノード' },
  range: { id: 'range', label: '射程', emoji: '📏', desc: 'この武器の射程/範囲 +1/ノード' },
  pierce: { id: 'pierce', label: '貫通', emoji: '➡️', desc: '直線がさらに奥へ +1/ノード', lineOnly: true },
  area: { id: 'area', label: '範囲', emoji: '💠', desc: '同時に当たる範囲/対象が広がる +1/ノード', notField: true },
  unique: { id: 'unique', label: '固有', emoji: '✨', desc: 'この武器だけの強力な底上げ +10〜15%/ノード' },
};
/** その武器にそのステータス強化が有効か（貫通は直線系のみ／範囲はフィールド系以外）。 */
export const weaponStatApplies = (stat: WeaponStat, w: WeaponId): boolean => {
  const def = WEAPON_STAT_DEFS[stat]; const pat = WEAPON_DEFS[w].pattern;
  if (def.lineOnly && pat !== 'cross' && pat !== 'forward') return false;
  if (def.notField && (pat === 'around' || pat === 'ring')) return false;
  return true;
};

// ===== 階層ごとのグリッド型スキルツリー（武器ごとに5グリッド＝5階層） =====
// 各階層は1つのグリッド。中央が起点（最初から解放可）・隣接を買うと外へ広がる。
// 階層が深いほどグリッドは大きく(5x5→10x10)・素材は上位＆高額＝終盤ほど上げにくい。
// 前の階層を一定数解放すると次の階層グリッドが解禁。
export const SKILL_GRID_SIZES = [5, 6, 8, 9, 10] as const; // 階層1..5
export const SKILL_TIERS = SKILL_GRID_SIZES.length;        // 5
export const skillGridSize = (tier: number): number => SKILL_GRID_SIZES[tier] ?? SKILL_GRID_SIZES[SKILL_GRID_SIZES.length - 1]!;
export const skillGridCenter = (tier: number): number => Math.floor((skillGridSize(tier) - 1) / 2);
/** 次の階層グリッドを解禁するのに必要な「前の階層の解放数」（外ほど多い＝終盤ほど重い）。 */
export const skillGridUnlockNeed = (tier: number): number => Math.ceil(skillGridSize(tier) ** 2 * 0.35);

export interface WeaponSkillNode {
  readonly x: number; readonly y: number;          // そのグリッド内の座標
  readonly tier: number;                            // 階層(=どのグリッド。0..SKILL_TIERS-1)
  readonly stat: WeaponStat; readonly amount: number;
  readonly matId: MaterialId; readonly matCost: number; // 解放に必要な素材と個数
  readonly big?: boolean;
  readonly root?: boolean;                          // そのグリッドの中央（階層が解禁されたら最初に解放可能）
  readonly requires: readonly number[];            // 同グリッド内の上下左右隣接ノードindex（どれか解放済みで解禁）
}
/** ノードの素材コスト（階層が深いほど上位素材＆高額・グリッド外周ほど少し高い。ツルハシ序盤の範囲だけ安い）。 */
function nodeCost(tier: number, ring: number, special: boolean, pickArea: boolean): { matId: MaterialId; matCost: number } {
  if (pickArea) return { matId: MATERIAL_IDS[0]!, matCost: 25 }; // サクサク用：ツルハシ中央左右の範囲は土で安く
  const matIndex = Math.min(MATERIAL_IDS.length - 1, tier + Math.floor(ring / 2)); // 階層主・外周従
  const base = Math.round(10 * Math.pow(2.4, tier));                               // 10,24,58,138,332
  const amount = Math.max(1, Math.round(base * (1 + ring * 0.4)));
  return { matId: MATERIAL_IDS[matIndex]!, matCost: special ? amount * 6 : amount };
}
// 決定的PRNG（武器ごとに seed を変えて形を変える）。
const treeRand = (seed: number): (() => number) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** ツリーで取れる特殊強化。範囲(area)/貫通(pierce)は強すぎたためツリーから削除し、射程(range)のみ。
 * ツルハシ(front)は射程概念がないので無し（範囲は中央左右の3方向ぶんだけ別途・安価に置く）。 */
function weaponSpecials(w: WeaponId): WeaponStat[] {
  return WEAPON_DEFS[w].pattern === 'front' ? [] : ['range'];
}
interface Cell { grid: number; x: number; y: number; ring: number; stat: WeaponStat; amount: number; special: boolean; pickArea: boolean; root: boolean; statKey: number; sortKey: number }
/** 1武器ぶんの「5グリッド（5階層）」ツリーを生成。各グリッドは中央起点・隣接で解放。特殊は深い階層へ分散（終盤まで）。 */
function genSkillTree(seed: number, w: WeaponId): WeaponSkillNode[] {
  const rnd = treeRand(seed);
  const isPick = WEAPON_DEFS[w].pattern === 'front';
  // 全グリッドのセルを生成（flat index = 生成順。グリッド0→1→…）。
  const cells: Cell[] = [];
  const startOf: number[] = [];
  for (let tier = 0; tier < SKILL_TIERS; tier++) {
    startOf[tier] = cells.length;
    const size = skillGridSize(tier), cen = skillGridCenter(tier);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      cells.push({ grid: tier, x, y, ring: Math.max(Math.abs(x - cen), Math.abs(y - cen)), stat: 'damage', amount: 0.03, special: false, pickArea: false, root: x === cen && y === cen, statKey: rnd(), sortKey: rnd() });
    }
  }
  const indexAt = (tier: number, x: number, y: number): number => startOf[tier]! + y * skillGridSize(tier) + x;
  const cellAt = (tier: number, x: number, y: number): Cell => cells[indexAt(tier, x, y)]!;
  for (const cell of cells) if (cell.root) cell.amount = 0.05; // 中央＝起点（少し大きめ）
  if (isPick) { const cen = skillGridCenter(0); for (const dx of [-1, 1]) { const cell = cellAt(0, cen + dx, cen); cell.stat = 'area'; cell.amount = 1; cell.special = true; cell.pickArea = true; } } // 階層1の中央左右＝安い範囲（3方向・ツルハシのみ）
  // 特殊(射程のみ)を階層1..4へ分散配置（外へ進むほど増える＝終盤まで）。
  const queue: WeaponStat[] = [];
  for (const stat of weaponSpecials(w)) for (let i = 0; i < 4; i++) queue.push(stat);
  const gridSpan = SKILL_TIERS - 1; // 階層1..(SKILL_TIERS-1)
  const avail = new Map<number, Cell[]>();
  for (let t = 1; t < SKILL_TIERS; t++) avail.set(t, cells.filter((c) => c.grid === t && !c.special && !c.root && c.ring >= 1).sort((a, b) => (b.ring - a.ring) || (a.sortKey - b.sortKey))); // 外周優先
  const ptr = new Map<number, number>();
  for (let qi = 0; qi < queue.length; qi++) {
    let t = 1 + (qi % gridSpan);
    for (let tries = 0; tries < gridSpan; tries++) { if ((ptr.get(t) ?? 0) < (avail.get(t)?.length ?? 0)) break; t = 1 + ((t - 1 + 1) % gridSpan); }
    const arr = avail.get(t); if (!arr) continue; const pi = ptr.get(t) ?? 0; if (pi >= arr.length) continue;
    const cell = arr[pi]!; ptr.set(t, pi + 1); cell.stat = queue[qi]!; cell.amount = 1; cell.special = true;
  }
  // 固有を中盤グリッド(2,3)に数個。
  const uniqueCells = cells.filter((c) => (c.grid === 2 || c.grid === 3) && !c.special && !c.root).sort((a, b) => a.statKey - b.statKey).slice(0, 4);
  for (const u of uniqueCells) { u.stat = 'unique'; u.amount = 0.10; u.special = true; }
  // 残りは小さなfiller（damage/speed）。
  for (const cell of cells) if (!cell.special && !cell.root) cell.stat = cell.statKey < 0.4 ? 'speed' : 'damage';
  // 同グリッド内の上下左右を requires に（中央は最初から解放可）。
  const neighbors = (cell: Cell): number[] => {
    const size = skillGridSize(cell.grid);
    return ([[cell.x - 1, cell.y], [cell.x + 1, cell.y], [cell.x, cell.y - 1], [cell.x, cell.y + 1]] as const)
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size).map(([nx, ny]) => indexAt(cell.grid, nx, ny));
  };
  return cells.map((cell) => ({
    x: cell.x, y: cell.y, tier: cell.grid, stat: cell.stat, amount: cell.amount, big: cell.special, root: cell.root || undefined,
    ...nodeCost(cell.grid, cell.ring, cell.special, cell.pickArea), requires: neighbors(cell),
  }));
}

// 遅延生成＋メモ化（balance との循環初期化を避ける＝初回参照時に生成）。
const treeCache = new Map<WeaponId, readonly WeaponSkillNode[]>();
/** 武器ごとのスキルツリー（決定的・武器ごとに形が違う）。 */
export function weaponSkillNodes(w: WeaponId): readonly WeaponSkillNode[] {
  let t = treeCache.get(w);
  if (!t) { t = genSkillTree(Math.imul(WEAPON_IDS.indexOf(w) + 1, 2654435761), w); treeCache.set(w, t); }
  return t;
}
