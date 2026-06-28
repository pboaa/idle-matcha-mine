import type { Cell } from '@domain/grid/position';
import type { MiningBalance, MiningKind } from '@domain/mining/balance';
import { defaultMiningBalance } from '@domain/mining/balance';

/** ワールド寸法・拠点（balance から導出）。 */
export const totalTilesOf = (b: MiningBalance = defaultMiningBalance): number => b.worldSize * b.worldSize;
export const baseOf = (b: MiningBalance = defaultMiningBalance): Cell => { const h = Math.floor(b.worldSize / 2); return { x: h, y: h }; };
export const inBounds = (c: Cell, b: MiningBalance = defaultMiningBalance): boolean =>
  c.x >= 0 && c.y >= 0 && c.x < b.worldSize && c.y < b.worldSize;

const hash = (x: number, y: number, floor: number): number =>
  (((x * 73856093) ^ (y * 19349663) ^ ((floor + 1) * 83492791)) >>> 0) % 100;

/** 座標＋階から決まるブロック種類（決定的・深い階ほど rich）。 */
export function kindAt(c: Cell, floor: number, b: MiningBalance = defaultMiningBalance): MiningKind {
  const h = hash(c.x, c.y, floor);
  const t = b.kindThresh;
  const boost = Math.min(t.boostMax, floor * t.boostPerFloor);
  if (h < t.dirtMax - boost) return b.kinds.dirt;
  if (h < t.stoneMax - Math.floor(boost / 2)) return b.kinds.stone;
  if (h < t.oreMax) return b.kinds.ore;
  return b.kinds.gem;
}

/** 採掘1ブロックのHP（階が深いほど硬い・幾何級数）。乗算で伸びる火力と同じ土俵に乗せ周回ペースを安定させる。 */
export const tileHardness = (floor: number, b: MiningBalance = defaultMiningBalance): number =>
  b.hardnessBase * Math.pow(b.hardnessGrowth, floor);

/** 採掘で得る価値（種類 × 階の深さ[幾何級数] × コイン倍率）。硬さより緩い倍率で「深い＝リッチだが無限インフレしない」。 */
export const tileValue = (kind: MiningKind, floor: number, coinMult: number, b: MiningBalance = defaultMiningBalance): number =>
  Math.round(kind.mult * Math.pow(b.valueGrowth, floor) * coinMult);
