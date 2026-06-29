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

// ===== グリッド型スキルツリー（中央から外へ広げる・隣接で解禁） =====
export interface WeaponSkillNode {
  readonly x: number; readonly y: number;          // グリッド座標（0..SKILL_GRID-1）
  readonly tier: number;                            // 中央からの距離(リング)＝階層。外ほど高コスト＝終盤。
  readonly stat: WeaponStat; readonly amount: number;
  readonly matId: MaterialId; readonly matCost: number; // 解放に必要な素材と個数
  readonly big?: boolean;
  readonly root?: boolean;                          // 中央（最初から解放可能な起点）
  readonly requires: readonly number[];            // 上下左右の隣接ノードindex（どれか解放済みで解禁）
}
const GRID_R = 4;                                   // 半径4 → 9x9（中央から5リング＝5階層・〜10x10規模）
export const SKILL_GRID = GRID_R * 2 + 1;
const ringOf = (x: number, y: number): number => Math.max(Math.abs(x - GRID_R), Math.abs(y - GRID_R));
const RING_MAT = [0, 1, 3, 4, 6]; // リング→素材index（土/石/銅/鉄/金）。外ほど上位。
/** ノードの素材コスト（中央付近は安く・外ほど上位素材＆高額。ツルハシ序盤の範囲だけ特別に安い）。 */
function ringCost(ring: number, special: boolean, pickArea: boolean): { matId: MaterialId; matCost: number } {
  if (pickArea) return { matId: MATERIAL_IDS[0]!, matCost: 25 }; // サクサク用：ツルハシ左右の範囲は土で安く
  const matIndex = Math.min(MATERIAL_IDS.length - 1, (RING_MAT[Math.min(ring, GRID_R)] ?? 6) + (special && ring >= 2 ? 1 : 0));
  const base = Math.round(12 * Math.pow(1.9, ring)); // 12,23,43,82,156
  return { matId: MATERIAL_IDS[matIndex]!, matCost: Math.max(1, special ? base * 6 : base) };
}
// 決定的PRNG（武器ごとに seed を変えて形を変える）。
const treeRand = (seed: number): (() => number) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** その武器で意味を持つ特殊強化（範囲/射程/貫通）。三択には載せずツリーで取る。 */
function weaponSpecials(w: WeaponId): WeaponStat[] {
  const pat = WEAPON_DEFS[w].pattern;
  const out: WeaponStat[] = [];
  if (weaponStatApplies('area', w)) out.push('area');     // 範囲: spread/同時対象（フィールド系以外）
  if (pat !== 'front') out.push('range');                  // 射程: 前方(ツルハシ)は射程概念がないので除外
  if (weaponStatApplies('pierce', w)) out.push('pierce'); // 貫通: 直線系のみ
  return out;
}
/** 1武器ぶんのグリッドツリーを生成。中央=起点、隣接で解禁。ツルハシは中央左右に安い範囲（すぐ3方向）。
 * その他の範囲/射程/貫通は外側リング（終盤）に分散。ビーム/ドリルの範囲は8本(=spread6)に届く6個。 */
function genSkillTree(seed: number, w: WeaponId): WeaponSkillNode[] {
  const rnd = treeRand(seed);
  const isPick = WEAPON_DEFS[w].pattern === 'front';
  const N = SKILL_GRID, c = GRID_R;
  interface Cell { x: number; y: number; ring: number; stat: WeaponStat; amount: number; special: boolean; pickArea: boolean; root: boolean; key: number; sortKey: number }
  const cells: Cell[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cells.push({ x, y, ring: ringOf(x, y), stat: 'damage', amount: 0.03, special: false, pickArea: false, root: false, key: rnd(), sortKey: rnd() });
  const at = (x: number, y: number): Cell => cells[y * N + x]!;
  const center = at(c, c); center.root = true; center.amount = 0.05; // 中央＝起点（最初から解放可能・少し大きめ）
  if (isPick) { // 中央の左右に範囲（安い）＝すぐ前方+左+右の3方向
    for (const dx of [-1, 1]) { const cell = at(c + dx, c); cell.stat = 'area'; cell.amount = 1; cell.special = true; cell.pickArea = true; }
  }
  // 特殊(範囲/射程/貫通)を外側リング(>=2)へ決定的に配置。ビーム/ドリルの範囲は6個。
  const queue: WeaponStat[] = [];
  for (const stat of weaponSpecials(w)) {
    if (isPick && stat === 'area') continue; // ツルハシの範囲は左右に置き済み
    const isLineArea = stat === 'area' && (WEAPON_DEFS[w].pattern === 'cross' || WEAPON_DEFS[w].pattern === 'forward');
    const n = isLineArea ? 6 : 4;
    for (let i = 0; i < n; i++) queue.push(stat);
  }
  // 外側リング(2..GRID_R)に分散配置＝外へ広げるほど特殊が増える（範囲なら方向が1つずつ・終盤まで）。
  const ringCells = new Map<number, Cell[]>();
  for (let r = 2; r <= GRID_R; r++) ringCells.set(r, cells.filter((x) => x.ring === r && !x.special && !x.root).sort((a, b) => a.sortKey - b.sortKey));
  const ringSpan = GRID_R - 2 + 1; // 2..GRID_R
  const ptr = new Map<number, number>();
  for (let qi = 0; qi < queue.length; qi++) {
    let ring = 2 + (qi % ringSpan);                         // ラウンドロビンで 2,3,4… に振り分け
    for (let tries = 0; tries < ringSpan; tries++) { const arr = ringCells.get(ring)!; if ((ptr.get(ring) ?? 0) < arr.length) break; ring = 2 + ((ring - 2 + 1) % ringSpan); }
    const arr = ringCells.get(ring)!; const pi = ptr.get(ring) ?? 0; if (pi >= arr.length) continue;
    const cell = arr[pi]!; ptr.set(ring, pi + 1); cell.stat = queue[qi]!; cell.amount = 1; cell.special = true;
  }
  // 固有を中盤リング(2-3)に数個。
  const uniqueCells = cells.filter((x) => (x.ring === 2 || x.ring === 3) && !x.special && !x.root).sort((a, b) => a.key - b.key).slice(0, 3);
  for (const u of uniqueCells) { u.stat = 'unique'; u.amount = 0.10; u.special = true; }
  // 残りは小さなfiller（damage/speed）。
  for (const cell of cells) { if (!cell.special && !cell.root) cell.stat = cell.key < 0.4 ? 'speed' : 'damage'; }
  // 隣接(上下左右)を requires に。解禁はどれか1つが解放済みなら可（中央は最初から可）。
  const idx = (x: number, y: number): number => y * N + x;
  const neighbors = (x: number, y: number): number[] => ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < N && ny < N).map(([nx, ny]) => idx(nx, ny));
  return cells.map((cell) => ({
    x: cell.x, y: cell.y, tier: cell.ring, stat: cell.stat, amount: cell.amount, big: cell.special, root: cell.root || undefined,
    ...ringCost(cell.ring, cell.special, cell.pickArea), requires: neighbors(cell.x, cell.y),
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
