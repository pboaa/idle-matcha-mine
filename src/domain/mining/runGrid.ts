/**
 * 走行グリッド（その周だけ・ランダム生成）。中央起点・隣接で外へ広げるフォグ型。
 * 各マス＝passives.ts の一時バフ。レベルアップで1マス無料解放／コインで即時解放・リロール。
 * 恒久のお宝図鑑(treasures.ts)とは別物（こちらは転生でリセットされる走行限定の一時バフ）。
 */
import { createRng } from '@shared/rng';
import { PASSIVE_DEFS, PASSIVE_IDS, WEAPON_DEFS, type PassiveId, type WeaponId, type WeaponTag, type PassiveEffect } from '@domain/mining/balance';

export interface RunNode {
  readonly x: number; readonly y: number;
  readonly pid: PassiveId; readonly special: boolean;
  readonly root?: boolean; readonly requires: readonly number[];
}
export interface RunGrid {
  readonly size: number;
  readonly nodes: readonly RunNode[];
  readonly unlocked: readonly number[]; // 解放済みマスのindex（中央は最初から解放）
  readonly cap: number;                 // この走行で解放できる上限（中央を除くマス数・お宝で伸ばす）
  readonly coinUnlocks: number;         // コインで解放した回数（コスト逓増用）
  readonly rerolls: number;             // リロール回数（コスト逓増用）
}

const idxAt = (size: number, x: number, y: number): number => y * size + x;
const neighborsOf = (size: number, x: number, y: number): number[] =>
  ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const)
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size)
    .map(([nx, ny]) => idxAt(size, nx, ny));

// 貫通(pierce)・射程/範囲(range)は「1階層(リング)に1つまで」に制限して配置する。
const isLimited = (id: PassiveId): boolean => { const e = PASSIVE_DEFS[id].effect; return e === 'pierce' || e === 'range'; };
// 系統シナジー効果→対応する武器タグ（その系統の武器を持っている時だけ有効）。
const SYNERGY_TAG: Partial<Record<PassiveEffect, WeaponTag>> = { meleeDmg: 'melee', shotDmg: 'shot', beamDmg: 'beam', fieldDmg: 'field' };
/** 装備武器に意味のある特殊か（無関係なシナジー/貫通は出さない）。武器が2種なので関係ないものを除外。 */
function usefulSpecial(id: PassiveId, equipped: readonly WeaponId[]): boolean {
  const d = PASSIVE_DEFS[id];
  if (d.reqWeapon && !equipped.includes(d.reqWeapon)) return false;        // 武器固有ユニーク
  const tag = SYNERGY_TAG[d.effect];
  if (tag) return equipped.some((w) => WEAPON_DEFS[w].tag === tag);        // 系統シナジーは該当系統の武器がある時だけ
  if (d.effect === 'pierce') return equipped.some((w) => WEAPON_DEFS[w].pattern === 'cross' || WEAPON_DEFS[w].pattern === 'forward'); // 貫通は直線武器がある時だけ
  return true; // power/crit/haste/range 等は全般に有効
}
/** その周のフィラー（汎用・弱め）と特殊（少数・強め）に分類。意味のない強化は除外。 */
function poolsFor(equipped: readonly WeaponId[]): { fillers: PassiveId[]; specials: PassiveId[] } {
  const fillers = PASSIVE_IDS.filter((id) => { const d = PASSIVE_DEFS[id]; return !d.special && !d.reqWeapon && !isLimited(id); });
  const specials = PASSIVE_IDS.filter((id) => PASSIVE_DEFS[id].special && usefulSpecial(id, equipped));
  return { fillers, specials };
}

/** 走行グリッドを生成（毎走ランダム・中央は最初から解放・cap=解放上限）。 */
export function genRunGrid(seed: number, size: number, equipped: readonly WeaponId[], cap: number): RunGrid {
  const rng = createRng(seed);
  const { fillers, specials } = poolsFor(equipped);
  const cen = Math.floor((size - 1) / 2);
  const rootIndex = idxAt(size, cen, cen);
  const nodes: RunNode[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const root = x === cen && y === cen;
    const pid = root ? 'power' : fillers[Math.floor(rng.next() * fillers.length)]!;
    nodes.push({ x, y, pid, special: false, root: root || undefined, requires: neighborsOf(size, x, y) });
  }
  // 特殊マスを散りばめる（中央以外・約 size 個）。貫通/範囲は「1階層(中央からのリング)に1つまで」。
  const ringOf = (i: number): number => { const n = nodes[i]!; return Math.max(Math.abs(n.x - cen), Math.abs(n.y - cen)); };
  const ringHasLimited = new Map<string, boolean>(); // `${ring}:${effect}` → 既に配置済み
  const nonLimited = specials.filter((s) => !isLimited(s));
  const forced = specials.filter(isLimited); // 貫通/範囲を優先配置＝適度に復活（各1つは確実に出す）
  const cand = nodes.map((_, i) => i).filter((i) => !nodes[i]!.root);
  const want = Math.min(cand.length, specials.length === 0 ? 0 : Math.max(3, Math.round(size * 1.2)));
  for (let k = 0; k < want; k++) {
    const ci = Math.floor(rng.next() * cand.length);
    const ni = cand.splice(ci, 1)[0]!;
    let pid = forced.length > 0 ? forced.shift()! : specials[Math.floor(rng.next() * specials.length)]!;
    if (isLimited(pid)) {
      const key = `${ringOf(ni)}:${PASSIVE_DEFS[pid].effect}`;
      if (ringHasLimited.get(key)) pid = nonLimited.length > 0 ? nonLimited[Math.floor(rng.next() * nonLimited.length)]! : pid; // この階層は埋まってる→別の特殊へ
      else ringHasLimited.set(key, true);
    }
    nodes[ni] = { ...nodes[ni]!, pid, special: true };
  }
  return { size, nodes, unlocked: [rootIndex], cap, coinUnlocks: 0, rerolls: 0 };
}

/** 解放済みマス数（中央を除く＝上限と比較する数）。 */
export const runGridFilled = (grid: RunGrid): number => grid.unlocked.filter((i) => !grid.nodes[i]?.root).length;
/** 上限まで埋まったか。 */
export const runGridFull = (grid: RunGrid): boolean => runGridFilled(grid) >= grid.cap;

/** そのマスが今解放可能か（未解放・中央or隣接が解放済み・上限未満）。 */
export function runGridUnlockable(grid: RunGrid, i: number): boolean {
  const n = grid.nodes[i]; if (!n || grid.unlocked.includes(i)) return false;
  if (runGridFull(grid)) return false; // 上限に達したらこれ以上開けない
  return !!n.root || n.requires.some((r) => grid.unlocked.includes(r));
}
/** マスを解放（純粋・解放権/コインの消費は呼び出し側）。 */
export function runGridUnlock(grid: RunGrid, i: number): RunGrid {
  if (!runGridUnlockable(grid, i)) return grid;
  return { ...grid, unlocked: [...grid.unlocked, i] };
}
/** 未解放・非中央マスのバフを再抽選（リロール）。 */
export function rerollRunGrid(grid: RunGrid, seed: number, equipped: readonly WeaponId[]): RunGrid {
  const rng = createRng(seed);
  const { fillers, specials } = poolsFor(equipped);
  const nodes = grid.nodes.map((n, i) => {
    if (n.root || grid.unlocked.includes(i)) return n;
    const special = specials.length > 0 && rng.next() < 0.18;
    const pid = special ? specials[Math.floor(rng.next() * specials.length)]! : fillers[Math.floor(rng.next() * fillers.length)]!;
    return { ...n, pid, special };
  });
  return { ...grid, nodes, rerolls: grid.rerolls + 1 };
}
/** 解放済みマスを passive毎の個数に集計（passiveTotals に渡す）。 */
export function runPassiveLevels(grid: RunGrid): Partial<Record<PassiveId, number>> {
  const out: Partial<Record<PassiveId, number>> = {};
  for (const i of grid.unlocked) { const n = grid.nodes[i]; if (n) out[n.pid] = (out[n.pid] ?? 0) + 1; }
  return out;
}
