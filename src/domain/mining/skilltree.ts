/**
 * スキルツリー（グリッド型）のマスターデータ＆生成。武器ごとのツリー＋全体強化の「メイン」ツリー。
 * 各階層=1グリッド。中央が起点・隣接で外へ広げる。前の階層を一定数解放で次が解禁。
 * 特殊系（範囲/射程/貫通/固有/全体強化の上位）は1グリッドに約2個だけ＝インフレ防止。コストは高め＝全部は上げ切れない。
 */
import { WEAPON_DEFS, WEAPON_IDS, type WeaponId } from '@domain/mining/balance';

// ===== 武器ステータス（武器ツリーで伸ばす） =====
export type WeaponStat = 'damage' | 'speed' | 'range' | 'pierce' | 'area' | 'unique';
export const WEAPON_STATS: readonly WeaponStat[] = ['damage', 'speed', 'range', 'pierce', 'area', 'unique'];
// ===== 全体ステータス（メインツリーで伸ばす・全武器/採掘に効く） =====
export type MainStat = 'power' | 'haste' | 'mine' | 'crit' | 'coin' | 'xp';
export const MAIN_STATS: readonly MainStat[] = ['power', 'haste', 'mine', 'crit', 'coin', 'xp'];
export type SkillStat = WeaponStat | MainStat;

export interface SkillStatDef { readonly label: string; readonly emoji: string; readonly desc: string; readonly lineOnly?: boolean; readonly notField?: boolean; readonly count?: boolean }
export const WEAPON_STAT_DEFS: Record<WeaponStat, SkillStatDef> = {
  damage: { label: 'ダメージ', emoji: '⚔️', desc: 'この武器のダメージ +5%/ノード' },
  speed: { label: '攻撃速度', emoji: '⏱️', desc: 'この武器の攻撃が速くなる +5%/ノード' },
  range: { label: '射程', emoji: '📏', desc: 'この武器の射程/範囲 +1/ノード', count: true },
  pierce: { label: '貫通', emoji: '➡️', desc: '直線がさらに奥へ +1/ノード', lineOnly: true, count: true },
  area: { label: '範囲', emoji: '💠', desc: '同時に当たる範囲/対象が広がる +1/ノード', notField: true, count: true },
  unique: { label: '固有', emoji: '✨', desc: 'この武器だけの強力な底上げ +10〜15%/ノード' },
};
export const MAIN_STAT_DEFS: Record<MainStat, SkillStatDef & { readonly per: number }> = {
  power: { label: '全体火力', emoji: '🔥', desc: '全武器のダメージ +4%/ノード', per: 0.04 },
  haste: { label: '全体速度', emoji: '🌀', desc: '全武器の攻撃が速くなる +3%/ノード', per: 0.03 },
  mine: { label: '採掘速度', emoji: '⛏️', desc: '採掘/移動が速くなる +4%/ノード', per: 0.04 },
  crit: { label: '会心', emoji: '✨', desc: '会心率（3倍ダメージ） +1%/ノード', per: 0.01 },
  coin: { label: 'コイン', emoji: '🪙', desc: 'コイン獲得 +5%/ノード', per: 0.05 },
  xp: { label: '経験', emoji: '📖', desc: '経験値 +6%/ノード', per: 0.06 },
};
export const isMainStat = (s: SkillStat): s is MainStat => s in MAIN_STAT_DEFS;
export const skillStatDef = (s: SkillStat): SkillStatDef => isMainStat(s) ? MAIN_STAT_DEFS[s] : WEAPON_STAT_DEFS[s];
/** その武器にそのステータス強化が有効か（貫通は直線系のみ／範囲はフィールド系以外）。 */
export const weaponStatApplies = (stat: WeaponStat, w: WeaponId): boolean => {
  const def = WEAPON_STAT_DEFS[stat]; const pat = WEAPON_DEFS[w].pattern;
  if (def.lineOnly && pat !== 'cross' && pat !== 'forward') return false;
  if (def.notField && (pat === 'around' || pat === 'ring')) return false;
  return true;
};

// ===== 階層ごとのグリッド（5階層＝5グリッド・中央から外へ） =====
export const SKILL_GRID_SIZES = [5, 7, 9, 11, 13] as const;
export const SKILL_TIERS = SKILL_GRID_SIZES.length; // 5
export const skillGridSize = (tier: number): number => SKILL_GRID_SIZES[tier] ?? SKILL_GRID_SIZES[SKILL_GRID_SIZES.length - 1]!;
export const skillGridCenter = (tier: number): number => Math.floor((skillGridSize(tier) - 1) / 2);
export const skillGridUnlockNeed = (tier: number): number => Math.ceil(skillGridSize(tier) ** 2 * 0.22);

export interface WeaponSkillNode {
  readonly x: number; readonly y: number; readonly tier: number;
  readonly stat: SkillStat; readonly amount: number;
  readonly starReq: number; // 解放に必要な「累計★」のしきい値（消費しない・累計★がこの値以上で解放可）
  readonly big?: boolean; readonly root?: boolean;
  readonly requires: readonly number[];
}
// ★必要値: 累計★がこの値に達したら解放（減らない）。深い階層/外周/特殊ほど高い＝少しずつ高く。
function nodeStarReq(tier: number, ring: number, special: boolean, pickArea: boolean): number {
  const b = DEFAULT_STAR_REQ;
  if (pickArea) return b.base; // ツルハシ中央左右の範囲は最序盤で解放
  return Math.max(1, Math.round(b.base * Math.pow(b.growth, tier) * (1 + ring * 0.35) * (special ? b.specialMult : 1)));
}
// balance.ts の循環参照を避けるため係数はここで保持。累計★の絶対しきい値（深ノードほど多くの転生が要る）。
const DEFAULT_STAR_REQ = { base: 4, growth: 2.0, specialMult: 2.5 } as const;
const treeRand = (seed: number): (() => number) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

interface Cell { grid: number; x: number; y: number; ring: number; stat: SkillStat; amount: number; special: boolean; pickArea: boolean; root: boolean; sortKey: number }
interface GridConfig {
  readonly seed: number;
  readonly fillers: readonly { readonly stat: SkillStat; readonly amount: number; readonly w: number }[]; // 多数の小ノード
  readonly specials: readonly SkillStat[];                                                                 // 1グリッド約2個（種類は巡回＝バリエーション）
  readonly specialAmount: (stat: SkillStat, grid: number) => number;
  readonly pickArea?: boolean; // ツルハシ: 階層1中央左右に安い範囲
}
/** グリッド型ツリーを生成（武器/メイン共通）。 */
function genGrid(cfg: GridConfig): WeaponSkillNode[] {
  const rnd = treeRand(cfg.seed);
  const cells: Cell[] = []; const startOf: number[] = [];
  const fillerStat = (): { stat: SkillStat; amount: number } => { let r = rnd() * cfg.fillers.reduce((a, f) => a + f.w, 0); for (const f of cfg.fillers) { if ((r -= f.w) < 0) return f; } return cfg.fillers[0]!; };
  for (let tier = 0; tier < SKILL_TIERS; tier++) {
    startOf[tier] = cells.length; const size = skillGridSize(tier), cen = skillGridCenter(tier);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const f = fillerStat();
      cells.push({ grid: tier, x, y, ring: Math.max(Math.abs(x - cen), Math.abs(y - cen)), stat: f.stat, amount: f.amount, special: false, pickArea: false, root: x === cen && y === cen, sortKey: rnd() });
    }
  }
  const indexAt = (tier: number, x: number, y: number): number => startOf[tier]! + y * skillGridSize(tier) + x;
  const cellAt = (tier: number, x: number, y: number): Cell => cells[indexAt(tier, x, y)]!;
  for (const cell of cells) if (cell.root) cell.amount = cfg.fillers[0]!.amount * 1.6; // 中央＝起点（少し大きめ）
  if (cfg.pickArea) { const cen = skillGridCenter(0); for (const dx of [-1, 1]) { const c = cellAt(0, cen + dx, cen); c.stat = 'area'; c.amount = 1; c.special = true; c.pickArea = true; } }
  // 各グリッドに特殊系を約2個（種類を巡回＝バリエーション）。外周寄り・別マスに。
  let si = 0;
  for (let grid = 0; grid < SKILL_TIERS; grid++) {
    const want = grid === 0 && cfg.pickArea ? 0 : 2; // ツルハシの階層1は中央左右の範囲で充足
    for (let k = 0; k < want && cfg.specials.length > 0; k++) {
      const stat = cfg.specials[si++ % cfg.specials.length]!;
      const c = cells.filter((x) => x.grid === grid && !x.root && !x.pickArea && !x.special && x.ring >= 1).sort((a, b) => (b.ring - a.ring) || (a.sortKey - b.sortKey))[0];
      if (c) { c.stat = stat; c.amount = cfg.specialAmount(stat, grid); c.special = true; }
    }
  }
  const neighbors = (cell: Cell): number[] => { const size = skillGridSize(cell.grid); return ([[cell.x - 1, cell.y], [cell.x + 1, cell.y], [cell.x, cell.y - 1], [cell.x, cell.y + 1]] as const).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size).map(([nx, ny]) => indexAt(cell.grid, nx, ny)); };
  return cells.map((cell) => ({ x: cell.x, y: cell.y, tier: cell.grid, stat: cell.stat, amount: cell.amount, big: cell.special, root: cell.root || undefined, starReq: nodeStarReq(cell.grid, cell.ring, cell.special, cell.pickArea), requires: neighbors(cell) }));
}

function weaponSpecials(w: WeaponId): WeaponStat[] {
  const out: WeaponStat[] = [];
  if (weaponStatApplies('area', w)) out.push('area');
  if (WEAPON_DEFS[w].pattern !== 'front') out.push('range');
  if (weaponStatApplies('pierce', w)) out.push('pierce');
  out.push('unique');
  return out;
}

const treeCache = new Map<WeaponId, readonly WeaponSkillNode[]>();
/** 武器ごとのスキルツリー（決定的・武器ごとに形が違う）。 */
export function weaponSkillNodes(w: WeaponId): readonly WeaponSkillNode[] {
  let t = treeCache.get(w);
  if (!t) {
    const isPick = WEAPON_DEFS[w].pattern === 'front';
    const specials = weaponSpecials(w).filter((s) => !(isPick && s === 'area')); // ツルハシの範囲は中央左右ぶん
    t = genGrid({
      seed: Math.imul(WEAPON_IDS.indexOf(w) + 1, 2654435761),
      fillers: [{ stat: 'damage', amount: 0.03, w: 6 }, { stat: 'speed', amount: 0.03, w: 4 }],
      specials, specialAmount: (s, g) => (s === 'unique' ? 0.10 + g * 0.01 : 1), pickArea: isPick,
    });
    treeCache.set(w, t);
  }
  return t;
}
let mainCache: readonly WeaponSkillNode[] | null = null;
/** 全体強化のメインツリー（全武器/採掘に効く・バリエーション多め）。 */
export function mainSkillNodes(): readonly WeaponSkillNode[] {
  if (!mainCache) mainCache = genGrid({
    seed: 0x9e3779b1,
    fillers: [{ stat: 'power', amount: MAIN_STAT_DEFS.power.per, w: 5 }, { stat: 'mine', amount: MAIN_STAT_DEFS.mine.per, w: 4 }, { stat: 'haste', amount: MAIN_STAT_DEFS.haste.per, w: 3 }],
    specials: ['crit', 'coin', 'xp'], specialAmount: (s) => MAIN_STAT_DEFS[s as MainStat].per,
  });
  return mainCache;
}

// ===== 解禁判定（武器/メイン共通・ノード配列に対して） =====
export function gridOpenFor(nodes: readonly WeaponSkillNode[], unlocked: readonly number[], tier: number): boolean {
  if (tier <= 0) return true;
  const bought = unlocked.filter((i) => nodes[i]?.tier === tier - 1).length;
  return bought >= skillGridUnlockNeed(tier - 1);
}
export function nodeUnlockableIn(nodes: readonly WeaponSkillNode[], unlocked: readonly number[], i: number): boolean {
  const n = nodes[i]; if (!n || unlocked.includes(i)) return false;
  if (!gridOpenFor(nodes, unlocked, n.tier)) return false;
  return !!n.root || n.requires.some((r) => unlocked.includes(r));
}
/** 解放済みノードの累積（statごとの合計）。 */
export function sumSkillStats(nodes: readonly WeaponSkillNode[], unlocked: readonly number[]): Partial<Record<SkillStat, number>> {
  const out: Partial<Record<SkillStat, number>> = {};
  for (const i of unlocked) { const n = nodes[i]; if (n) out[n.stat] = (out[n.stat] ?? 0) + n.amount; }
  return out;
}
