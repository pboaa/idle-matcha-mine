import { createRng } from '@shared/rng';
import type { MiningBalance, WeaponId } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_IDS } from '@domain/mining/balance';
import { runGridUnlockable, runGridUnlock, rerollRunGrid } from '@domain/mining/runGrid';
import type { MineState } from '@application/mining/mineState';

export const xpForNext = (level: number, b: MiningBalance = defaultMiningBalance): number => b.xpBase + level * b.xpPerLevel;

/** この走行で装備中の武器（つるはし＋開始武器）。走行グリッドの武器固有バフ抽選に使う。 */
export const equippedWeapons = (state: MineState): WeaponId[] => WEAPON_IDS.filter((w) => state.levels[w] > 0);

// ===== 走行グリッド: コインでの即時解放・リロール（走行限定・少しずつ高く） =====
export const runUnlockCoinCost = (state: MineState, b: MiningBalance = defaultMiningBalance): number =>
  Math.floor(b.runCoinCostBase * Math.pow(b.runCoinGrowth, state.runGrid.coinUnlocks));
export const runRerollCoinCost = (state: MineState, b: MiningBalance = defaultMiningBalance): number =>
  Math.floor(b.runRerollCostBase * Math.pow(b.runRerollGrowth, state.runGrid.rerolls));

/** コインでマスを解放（上限まで・コスト逓増・解放ごとにお宝+1）。 */
export function buyRunUnlock(state: MineState, index: number, b: MiningBalance = defaultMiningBalance): MineState {
  if (!runGridUnlockable(state.runGrid, index)) return state;
  const cost = runUnlockCoinCost(state, b);
  if (state.coins < cost) return state;
  const grid = runGridUnlock(state.runGrid, index);
  return {
    ...state, coins: state.coins - cost,
    runGrid: { ...grid, coinUnlocks: grid.coinUnlocks + 1 },
    perm: { ...state.perm, treasure: state.perm.treasure + b.treasurePerUnlock },
  };
}
/** 一括購入: コインが足りる＆上限までのマスをまとめて解放。 */
export function buyRunBulk(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  let s = state;
  for (let guard = 0; guard < 400; guard++) {
    const avail = s.runGrid.nodes.map((_, i) => i).filter((i) => runGridUnlockable(s.runGrid, i));
    if (avail.length === 0) break; // 上限到達 or 解放可能なし
    if (s.coins < runUnlockCoinCost(s, b)) break; // コイン不足
    s = buyRunUnlock(s, avail[0]!, b);
  }
  return s;
}
/** コインで未解放マスのバフを再抽選（コスト逓増）。 */
export function rerollRun(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = runRerollCoinCost(state, b);
  if (state.coins < cost) return state;
  const rng = createRng(state.rngState);
  const seed = rng.state() ^ Math.floor(rng.next() * 0x7fffffff);
  const grid = rerollRunGrid(state.runGrid, seed >>> 0, equippedWeapons(state));
  return { ...state, coins: state.coins - cost, rngState: rng.state(), runGrid: grid };
}
