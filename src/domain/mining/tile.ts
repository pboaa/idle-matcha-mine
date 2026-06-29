import type { Cell } from '@domain/grid/position';
import type { MiningBalance, MiningKind } from '@domain/mining/balance';
import { defaultMiningBalance, MINING_KINDS } from '@domain/mining/balance';

/** ワールド寸法・拠点（balance から導出）。 */
export const totalTilesOf = (b: MiningBalance = defaultMiningBalance): number => b.worldSize * b.worldSize;
export const baseOf = (b: MiningBalance = defaultMiningBalance): Cell => { const h = Math.floor(b.worldSize / 2); return { x: h, y: h }; };
export const inBounds = (c: Cell, b: MiningBalance = defaultMiningBalance): boolean =>
  c.x >= 0 && c.y >= 0 && c.x < b.worldSize && c.y < b.worldSize;

const hash = (x: number, y: number, floor: number): number =>
  (((x * 73856093) ^ (y * 19349663) ^ ((floor + 1) * 83492791)) >>> 0) % 100;

/** 座標＋階から決まるブロック種類（決定的・8段階）。深いほど上位素材が解禁され出やすくなる＝最初は土ばかり。 */
export function kindAt(c: Cell, floor: number, b: MiningBalance = defaultMiningBalance): MiningKind {
  const h = hash(c.x, c.y, floor); // 0..99
  // h が小さいほどレア。上位tierから順に[0,p)を割り当て、余りが土(tier0)。
  let acc = 0;
  for (let tier = b.matTiers.length; tier >= 1; tier--) {
    const cfg = b.matTiers[tier - 1]!;
    const p = floor >= cfg.unlockFloor ? Math.min(cfg.max, (floor - cfg.unlockFloor + 1) * cfg.perFloor) : 0;
    if (h < acc + p) return MINING_KINDS[tier]!;
    acc += p;
  }
  return MINING_KINDS[0]!; // 土
}

/** 拠点（中心）からのチェビシェフ距離（同心リング状）。 */
export const tileDist = (c: Cell, b: MiningBalance = defaultMiningBalance): number => {
  const base = baseOf(b);
  return Math.max(Math.abs(c.x - base.x), Math.abs(c.y - base.y));
};

/** 採掘1ブロックのHP（階[幾何級数]×拠点距離×種類）。深い階・外周・上位鉱石ほど硬い。 */
export const tileHardness = (floor: number, dist: number, hardMult = 1, b: MiningBalance = defaultMiningBalance): number =>
  b.hardnessBase * Math.pow(b.hardnessGrowth, floor) * (1 + dist * b.distHardness) * hardMult;

/** 採掘で得る価値（種類 × 階の深さ[幾何級数] × コイン倍率）。硬さより緩い倍率で「深い＝リッチだが無限インフレしない」。 */
export const tileValue = (kind: MiningKind, floor: number, coinMult: number, b: MiningBalance = defaultMiningBalance): number =>
  Math.round(kind.mult * Math.pow(b.valueGrowth, floor) * coinMult);
