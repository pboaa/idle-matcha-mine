export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** 後方互換: 座標は Cell と同一。 */
export type Position = Cell;

/** 90°回転ステップ（0,1,2,3 = 0/90/180/270°）。 */
export type Rot = 0 | 1 | 2 | 3;

export const cellKey = (c: Cell): string => `${c.x},${c.y}`;
export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/** セルを rot×90° 回転する（時計回り: (x,y)→(-y,x)）。 */
export function rotateCell(c: Cell, rot: Rot): Cell {
  switch (rot & 3) {
    case 1:
      return { x: -c.y, y: c.x };
    case 2:
      return { x: -c.x, y: -c.y };
    case 3:
      return { x: c.y, y: -c.x };
    default:
      return c;
  }
}

export interface BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly w: number;
  readonly h: number;
}

export function boundingBox(cells: readonly Cell[]): BoundingBox {
  if (cells.length === 0) return { minX: 0, minY: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** 最小座標が (0,0) になるよう平行移動する。 */
export function normalizeCells(cells: readonly Cell[]): Cell[] {
  const { minX, minY } = boundingBox(cells);
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}
