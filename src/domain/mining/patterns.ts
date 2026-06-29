/**
 * 武器の「範囲」マスターデータ＝発射パターンの当たり判定（純粋関数・状態を持たない）。
 * step（採掘ループ）から分離して単体テストしやすくする。各パターンは「当たるマスと威力係数」を返す。
 * 威力係数factor: そのマスのダメージ = 1ヒットの基準ダメージ × factor。
 *  - front/nearest/burst = 1（等倍）
 *  - cross（ビーム）= 2/方向数（方向が増えても総DPS一定＝被覆だけ広がる）
 *  - forward（ドリル）= 1/(1+2*横幅)（横に広がっても総DPS一定）
 *  - around（オーラ）= 基準タイル数/現タイル数（半径が増えても総DPS一定）
 *  - ring（リング）= 基準半径/現半径（外周が増えても総DPS一定）
 */
import type { Cell } from '@domain/grid/position';
import { sameCell } from '@domain/grid/position';
import type { WeaponPattern } from '@domain/mining/balance';

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;        // 4方向（十字）
export const DIRS_H = [[1, 0], [-1, 0]] as const;                       // 2方向（横）
export const DIRS_8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const; // 8方向

/** target へ向かう隣接1マス（縦横どちらか・大きい差を優先）。 */
export function stepToward(from: Cell, target: Cell): Cell {
  const dx = target.x - from.x; const dy = target.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return { x: from.x + Math.sign(dx), y: from.y };
  if (dy !== 0) return { x: from.x, y: from.y + Math.sign(dy) };
  return from;
}
/** target へ向かう単位方向ベクトル（縦横）。 */
export const dirToward = (from: Cell, target: Cell): Cell => {
  const n = stepToward(from, target);
  return { x: Math.sign(n.x - from.x), y: Math.sign(n.y - from.y) };
};
/** from から range 以内で最も近い「固い」マス（同心リング状に外へ探索）。 */
function nearestSolid(isSolid: (c: Cell) => boolean, from: Cell, range: number): Cell | null {
  for (let r = 1; r <= range; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const c = { x: from.x + dx, y: from.y + dy };
    if (isSolid(c)) return c;
  }
  return null;
}

/** パターン計算に必要な入力（その武器の今回の発射パラメータ）。 */
export interface PatternInput {
  readonly pos: Cell;
  readonly target: Cell | null;   // 手動の進行先（front/forward の向き）
  readonly range: number;         // 射程/半径
  readonly lineRange: number;     // 直線系の長さ（射程+貫通）
  readonly spread: number;        // 範囲段階（方向/横幅/横振り）
  readonly targets: number;       // 同時対象数（弾）
  readonly rangeBase: number;     // 基準射程（フィールド系の正規化用）
  readonly isSolid: (c: Cell) => boolean;
}
export interface PatternHit { readonly cell: Cell; readonly factor: number }

/** パターンごとの当たりマス＋威力係数を返す（純粋）。命中可否(固いか)の最終判定は呼び出し側で行う。 */
export function patternHits(pattern: WeaponPattern, p: PatternInput): PatternHit[] {
  switch (pattern) {
    case 'front': { // ツルハシ: 前方1マス＋範囲で1マスずつ右→左→…（spread2で前方+右+左=3方向）
      if (!p.target) return [];
      const f = stepToward(p.pos, p.target);
      if (sameCell(f, p.pos)) return [];
      const d = dirToward(p.pos, p.target); const perp = { x: d.y, y: d.x };
      const hits: PatternHit[] = [{ cell: f, factor: 1 }];
      for (let s = 1; s <= p.spread; s++) { const k = Math.ceil(s / 2); const sign = s % 2 === 1 ? 1 : -1; hits.push({ cell: { x: f.x + perp.x * sign * k, y: f.y + perp.y * sign * k }, factor: 1 }); }
      return hits;
    }
    case 'nearest': { // 弾: 近い固いマスから targets 個を撃つ
      const hits: PatternHit[] = [];
      for (let r = 1; r <= p.range && hits.length < p.targets; r++) for (let dy = -r; dy <= r && hits.length < p.targets; dy++) for (let dx = -r; dx <= r && hits.length < p.targets; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = { x: p.pos.x + dx, y: p.pos.y + dy };
        if (p.isSolid(c)) hits.push({ cell: c, factor: 1 });
      }
      return hits;
    }
    case 'burst': { // 爆弾: 近い固いマスを中心に (2*br+1)^2 の小爆発
      const c = nearestSolid(p.isSolid, p.pos, p.range); if (!c) return [];
      const br = 1 + Math.floor(p.spread / 2); const hits: PatternHit[] = [];
      for (let dy = -br; dy <= br; dy++) for (let dx = -br; dx <= br; dx++) hits.push({ cell: { x: c.x + dx, y: c.y + dy }, factor: 1 });
      return hits;
    }
    case 'cross': { // ビーム: spreadで 2→4→8方向。方向が増えるほど1方向は弱く＝総DPS一定。
      const dirs = p.spread <= 0 ? DIRS_H : p.spread === 1 ? DIRS : DIRS_8;
      const factor = 2 / dirs.length; const hits: PatternHit[] = [];
      for (const [dx, dy] of dirs) for (let r = 1; r <= p.lineRange; r++) hits.push({ cell: { x: p.pos.x + dx * r, y: p.pos.y + dy * r }, factor });
      return hits;
    }
    case 'forward': { // ドリル: 直線、spreadで横幅。横幅は被覆用＝総DPS一定。
      const d = p.target ? dirToward(p.pos, p.target) : { x: 1, y: 0 }; const perp = { x: d.y, y: d.x }; const hw = Math.floor(p.spread / 2);
      const factor = 1 / (1 + 2 * hw); const hits: PatternHit[] = [];
      for (let r = 1; r <= p.lineRange; r++) {
        hits.push({ cell: { x: p.pos.x + d.x * r, y: p.pos.y + d.y * r }, factor });
        for (let k = 1; k <= hw; k++) { hits.push({ cell: { x: p.pos.x + d.x * r + perp.x * k, y: p.pos.y + d.y * r + perp.y * k }, factor }); hits.push({ cell: { x: p.pos.x + d.x * r - perp.x * k, y: p.pos.y + d.y * r - perp.y * k }, factor }); }
      }
      return hits;
    }
    case 'around': { // オーラ: (2*range+1)^2。半径が増えても総DPS一定。
      const baseTiles = (2 * p.rangeBase + 1) ** 2, tiles = (2 * p.range + 1) ** 2; const factor = baseTiles / tiles; const hits: PatternHit[] = [];
      for (let dy = -p.range; dy <= p.range; dy++) for (let dx = -p.range; dx <= p.range; dx++) hits.push({ cell: { x: p.pos.x + dx, y: p.pos.y + dy }, factor });
      return hits;
    }
    case 'ring': { // リング: 外周。半径が増えても総DPS一定。
      const factor = p.rangeBase / Math.max(1, p.range); const hits: PatternHit[] = [];
      for (let dy = -p.range; dy <= p.range; dy++) for (let dx = -p.range; dx <= p.range; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === p.range) hits.push({ cell: { x: p.pos.x + dx, y: p.pos.y + dy }, factor });
      return hits;
    }
  }
}
