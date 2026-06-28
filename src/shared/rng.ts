/**
 * 決定的擬似乱数（mulberry32）。
 * シード状態のみで完全に再現可能 → 単体テスト・セーブ/ロード・オフライン計算で同一結果を保証する。
 * 副作用（実シードの生成）は infrastructure 側に置き、ここは純粋に保つ。
 */
export interface Rng {
  /** [0, 1) の乱数を返し、内部状態を進める。 */
  next(): number;
  /** 現在の内部状態（保存して createRng に渡せば続きから再現できる）。 */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state(): number {
      return a >>> 0;
    },
  };
}

/** [minInclusive, maxInclusive] の整数。 */
export const randomInt = (rng: Rng, minInclusive: number, maxInclusive: number): number =>
  minInclusive + Math.floor(rng.next() * (maxInclusive - minInclusive + 1));

/** [min, max) の実数。 */
export const randomFloat = (rng: Rng, min: number, max: number): number =>
  min + rng.next() * (max - min);

/** 確率 p (0..1) で true。 */
export const chance = (rng: Rng, p: number): boolean => rng.next() < p;

/** 配列から等確率で1要素。空配列はエラー。 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  const item = arr[Math.floor(rng.next() * arr.length)];
  return item as T;
}

/**
 * 期待値 expected の離散イベント発生数をサンプリングする。
 * 整数部はそのまま、端数は確率的に切り上げ（例: 2.3 → 70%で2, 30%で3）。
 * レート×Δt から「今ステップで何件起きたか」を求めるのに使う。
 */
export function sampleCount(rng: Rng, expected: number): number {
  if (expected <= 0) return 0;
  const whole = Math.floor(expected);
  const frac = expected - whole;
  return whole + (rng.next() < frac ? 1 : 0);
}

export interface Weighted<T> {
  readonly value: T;
  readonly weight: number;
}

/** 重み付き抽選。weight の合計に比例して選ばれる。 */
export function weightedPick<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  if (items.length === 0) throw new Error('weightedPick: empty array');
  const total = items.reduce((acc, it) => acc + it.weight, 0);
  if (total <= 0) throw new Error('weightedPick: total weight must be > 0');
  let roll = rng.next() * total;
  for (const it of items) {
    roll -= it.weight;
    if (roll < 0) return it.value;
  }
  // 浮動小数の誤差対策で末尾を返す
  return items[items.length - 1]!.value;
}
